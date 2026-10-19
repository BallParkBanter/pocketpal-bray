package com.pocketpal.shizuku

import android.content.ComponentName
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.pocketpal.BuildConfig
import com.pocketpal.specs.NativeShizukuShellSpec
import com.pocketpalai.shizuku.IShellService
import rikka.shizuku.Shizuku
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * TurboModule `ShizukuShell`: runs shell commands as the shell uid through a
 * Shizuku UserService ([ShellUserService]). Every call is safe when Shizuku is
 * not running: isRunning() is false and exec() rejects with SHIZUKU_NOT_RUNNING.
 */
@ReactModule(name = NativeShizukuShellSpec.NAME)
class ShizukuShellModule(reactContext: ReactApplicationContext) :
    NativeShizukuShellSpec(reactContext) {

  private val main = Handler(Looper.getMainLooper())
  private val worker = Executors.newCachedThreadPool()
  private val requestCodes = AtomicInteger(4200)

  @Volatile private var service: IShellService? = null
  @Volatile private var bindLatch: CountDownLatch? = null

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
      if (binder != null && binder.pingBinder()) {
        service = IShellService.Stub.asInterface(binder)
      }
      bindLatch?.countDown()
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      service = null
    }
  }

  private val userServiceArgs by lazy {
    Shizuku.UserServiceArgs(
        ComponentName(reactApplicationContext.packageName, ShellUserService::class.java.name))
        .daemon(false)
        .processNameSuffix("bray_shell")
        .debuggable(BuildConfig.DEBUG)
        .version(BuildConfig.VERSION_CODE)
  }

  private fun running(): Boolean =
      try {
        Shizuku.pingBinder()
      } catch (e: Throwable) {
        false
      }

  private fun granted(): Boolean =
      running() &&
          try {
            !Shizuku.isPreV11() &&
                Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
          } catch (e: Throwable) {
            false
          }

  override fun isRunning(promise: Promise) {
    promise.resolve(running())
  }

  override fun hasPermission(promise: Promise) {
    promise.resolve(granted())
  }

  override fun requestPermission(promise: Promise) {
    if (!running()) {
      promise.resolve(false)
      return
    }
    if (granted()) {
      promise.resolve(true)
      return
    }
    val code = requestCodes.incrementAndGet()
    val listener =
        object : Shizuku.OnRequestPermissionResultListener {
          override fun onRequestPermissionResult(requestCode: Int, grantResult: Int) {
            if (requestCode != code) return
            Shizuku.removeRequestPermissionResultListener(this)
            promise.resolve(grantResult == PackageManager.PERMISSION_GRANTED)
          }
        }
    main.post {
      try {
        Shizuku.addRequestPermissionResultListener(listener)
        Shizuku.requestPermission(code)
      } catch (e: Throwable) {
        Shizuku.removeRequestPermissionResultListener(listener)
        promise.reject("SHIZUKU_PERMISSION", e.message, e)
      }
    }
  }

  override fun exec(command: String, timeoutMs: Double, promise: Promise) {
    worker.execute {
      try {
        if (!running()) {
          promise.reject("SHIZUKU_NOT_RUNNING", "Shizuku isn't running")
          return@execute
        }
        if (!granted()) {
          promise.reject("SHIZUKU_NO_PERMISSION", "Shizuku permission not granted")
          return@execute
        }
        val svc = bind() ?: run {
          promise.reject("SHIZUKU_BIND_TIMEOUT", "Shizuku shell service did not start in 10 s")
          return@execute
        }
        promise.resolve(svc.exec(command, timeoutMs.toLong()))
      } catch (e: Throwable) {
        Log.w(TAG, "exec failed", e)
        service = null
        promise.reject("SHIZUKU_EXEC", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  /** Binds the UserService if needed; waits up to 10 s. Worker thread only. */
  @Synchronized
  private fun bind(): IShellService? {
    service?.let { if (it.asBinder().pingBinder()) return it }
    service = null
    val latch = CountDownLatch(1)
    bindLatch = latch
    main.post {
      try {
        Shizuku.bindUserService(userServiceArgs, connection)
      } catch (e: Throwable) {
        Log.w(TAG, "bindUserService failed", e)
        latch.countDown()
      }
    }
    latch.await(BIND_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    return service
  }

  override fun invalidate() {
    super.invalidate()
    if (service != null) {
      main.post {
        try {
          Shizuku.unbindUserService(userServiceArgs, connection, false)
        } catch (_: Throwable) {}
      }
    }
    worker.shutdown()
  }

  companion object {
    private const val TAG = "ShizukuShell"
    private const val BIND_TIMEOUT_MS = 10_000L
  }
}
