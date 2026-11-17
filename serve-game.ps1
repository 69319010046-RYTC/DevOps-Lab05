$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$listener = New-Object System.Net.HttpListener
$port = 8765
$started = $false

while (-not $started -and $port -lt 8785) {
    $prefix = "http://127.0.0.1:$port/"
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add($prefix)
    try {
        $listener.Start()
        $started = $true
    }
    catch {
        $port++
    }
}

if (-not $started) {
    Write-Error "Could not start the local game server. Close another game server or try again."
    exit 1
}

$url = "http://127.0.0.1:$port/"
Write-Host "Game server: $url"
Write-Host "Keep this window open while playing. Press Ctrl+C to stop the server."
Start-Process $url

$contentTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
            if ([string]::IsNullOrWhiteSpace($relativePath)) {
                $relativePath = "index.html"
            }

            $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))
            if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
                -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $context.Response.StatusCode = 404
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
            }
            else {
                $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                if ($contentTypes.ContainsKey($extension)) {
                    $context.Response.ContentType = $contentTypes[$extension]
                }
                else {
                    $context.Response.ContentType = "application/octet-stream"
                }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
            }

            $context.Response.ContentLength64 = $bytes.Length
            if ($context.Request.HttpMethod -ne "HEAD") {
                $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        }
        catch {
            Write-Warning "Could not serve request: $($_.Exception.Message)"
            $context.Response.StatusCode = 500
        }
        finally {
            $context.Response.Close()
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
