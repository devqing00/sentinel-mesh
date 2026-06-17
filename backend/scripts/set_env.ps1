$ErrorActionPreference = "Stop"
$appName = "sentinel-mesh-api-8f4b"
$rg = "sentinel-mesh-rg-francecentral"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

Write-Host "Reading .env..."
$envFile = ".\.env"
$settings = @()
foreach ($line in Get-Content $envFile) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) { continue }
    # Handle quotes and splitting
    $firstEqual = $line.IndexOf("=")
    if ($firstEqual -gt 0) {
        $key = $line.Substring(0, $firstEqual).Trim()
        $value = $line.Substring($firstEqual + 1).Trim().Trim('"').Trim("'")
        # App settings syntax: KEY=VALUE
        $settings += "$key=`"$value`""
    }
}

Write-Host "Configuring App Settings in Azure..."
# Pass settings as an array of arguments
$commandArgs = @("webapp", "config", "appsettings", "set", "--resource-group", $rg, "--name", $appName, "--settings") + $settings
& $az $commandArgs
Write-Host "App settings configured successfully."
