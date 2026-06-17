$ErrorActionPreference = "Continue"
$appName = "sentinel-mesh-api-8f4b"
$plan = "sentinel-mesh-plan-free"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

$regions = @("germanywestcentral", "francecentral")
$success = $false
$rg = ""

foreach ($loc in $regions) {
    Write-Host "Trying region: $loc"
    $currentRg = "sentinel-mesh-rg-$loc"
    
    # Create RG
    & $az group create --name $currentRg --location $loc | Out-Null
    
    # Try creating Plan
    Write-Host "Creating App Service Plan in $loc..."
    $planOutput = & $az appservice plan create --name $plan --resource-group $currentRg --sku F1 --is-linux 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $planOutput -notmatch "disallowed by Azure") {
        Write-Host "Successfully created App Service Plan in $loc"
        $rg = $currentRg
        $success = $true
        break
    } else {
        Write-Host "Failed in $loc. Cleaning up RG..."
        # Cleanup RG if plan failed
        & $az group delete --name $currentRg --yes --no-wait
    }
}

if (-not $success) {
    Write-Host "Failed to find an allowed region."
    exit 1
}

$ErrorActionPreference = "Stop"
Write-Host "Creating Web App in $rg..."
& $az webapp create --resource-group $rg --plan $plan --name $appName --runtime "PYTHON:3.11"

Write-Host "Creating Deployment ZIP..."
if (Test-Path app.zip) { Remove-Item app.zip }
Compress-Archive -Path * -DestinationPath app.zip -Force

Write-Host "Deploying ZIP to Web App..."
& $az webapp deployment source config-zip --resource-group $rg --name $appName --src app.zip

Write-Host "Configuring Startup Command..."
& $az webapp config set --resource-group $rg --name $appName --startup-file "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
