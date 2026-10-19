// Shizuku UserService for PocketPal Bray: runs inside a process started by
// Shizuku with the shell uid (2000).
package com.pocketpalai.shizuku;

interface IShellService {
    // Shizuku calls this transaction code to tear the service down.
    void destroy() = 16777114;

    // Runs `sh -c command`. Returns JSON
    // {"exitCode":int,"stdout":string,"stderr":string,"timedOut":bool}.
    String exec(String command, long timeoutMs) = 1;
}
