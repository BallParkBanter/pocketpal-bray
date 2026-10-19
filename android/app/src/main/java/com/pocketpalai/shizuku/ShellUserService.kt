package com.pocketpal.shizuku

import android.content.Context
import android.content.Intent
import androidx.annotation.Keep
import com.pocketpalai.shizuku.IShellService
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlin.system.exitProcess

/**
 * Runs in the process Shizuku starts for us (shell uid), not in the app.
 * Shizuku instantiates it by class name, so keep the no-arg constructor.
 */
@Keep
class ShellUserService() : IShellService.Stub() {

  private var context: Context? = null

  /** Shizuku 13+ passes a Context for our package when this constructor exists. */
  @Keep
  constructor(context: Context) : this() {
    this.context = context
  }

  override fun listApps(): String {
    val out = JSONArray()
    val ctx = context ?: return out.toString()
    val pm = ctx.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val seen = HashSet<String>()
    for (ri in pm.queryIntentActivities(intent, 0)) {
      val pkg = ri.activityInfo?.packageName ?: continue
      if (!seen.add(pkg)) continue
      val label = try { ri.loadLabel(pm).toString() } catch (_: Exception) { pkg }
      out.put(JSONObject().put("label", label).put("package", pkg))
    }
    return out.toString()
  }

  override fun destroy() {
    exitProcess(0)
  }

  override fun exec(command: String, timeoutMs: Long): String {
    val out = JSONObject()
    try {
      val proc = ProcessBuilder("sh", "-c", command).start()
      proc.outputStream.close()
      val stdout = Drain(proc.inputStream).also { it.start() }
      val stderr = Drain(proc.errorStream).also { it.start() }
      val finished = proc.waitFor(timeoutMs.coerceAtLeast(1), TimeUnit.MILLISECONDS)
      if (!finished) {
        proc.destroyForcibly()
        proc.waitFor(1, TimeUnit.SECONDS)
      }
      stdout.join(1000)
      stderr.join(1000)
      out.put("exitCode", if (finished) proc.exitValue() else -1)
      out.put("stdout", stdout.text())
      out.put("stderr", stderr.text())
      out.put("timedOut", !finished)
    } catch (e: Exception) {
      out.put("exitCode", -1)
      out.put("stdout", "")
      out.put("stderr", "${e.javaClass.simpleName}: ${e.message}")
      out.put("timedOut", false)
    }
    return out.toString()
  }

  /** Reads a stream on its own thread; keeps at most MAX_BYTES (binder limit). */
  private class Drain(private val input: InputStream) : Thread() {
    private val buf = ByteArrayOutputStream()
    private var truncated = false

    override fun run() {
      val chunk = ByteArray(8192)
      try {
        while (true) {
          val n = input.read(chunk)
          if (n < 0) break
          synchronized(buf) {
            val room = MAX_BYTES - buf.size()
            if (room > 0) buf.write(chunk, 0, minOf(n, room))
            if (n > room) truncated = true
          }
        }
      } catch (_: Exception) {
        // stream closed when the process was killed
      }
    }

    fun text(): String = synchronized(buf) {
      buf.toString(Charsets.UTF_8.name()) + if (truncated) "\n…(truncated)" else ""
    }
  }

  companion object {
    private const val MAX_BYTES = 256 * 1024
  }
}
