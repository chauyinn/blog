---

title: Configuring an SSL Certificate for Windows Remote Desktop
published: 2025-03-23
updated: 2025-03-23
description: 'Automate Let''s Encrypt SSL certificate provisioning and renewal for Windows Remote Desktop (RDP) using win-acme'
image: ''
tags: ["Windows", "Remote Desktop", "RDP", "SSL Certificate", "Security", "win-acme"]
category: 'System Optimization'
draft: false
lang: 'en'
---

## Introduction

By default, Windows Remote Desktop Services uses a self-signed certificate, which causes RDP clients to show an untrusted connection warning whenever you connect.

![image](./image.png)

Configuring a valid SSL certificate eliminates these warnings and ensures the security and integrity of your Remote Desktop sessions.

This guide walks through using **win-acme** to automatically request, install, and renew a free Let's Encrypt SSL certificate for Windows Remote Desktop Services.

## Prerequisites

Before getting started, you will need:

- A domain name pointing to your Windows server (e.g., `rdp.yourdomain.com`)
- Access to manage your domain's DNS records
- Administrator privileges on the Windows server

## Configuring the SSL Certificate

### 1. Install win-acme

1. Download the latest release from the [win-acme Releases page](https://github.com/win-acme/win-acme/releases/). Choose the `pluggable` build since we will be using a DNS validation plugin.
2. Extract the ZIP archive to a permanent location on the server, such as `C:\win-acme`.

### 2. Update win-acme Settings

1. Before running `win-acme` for the first time, `settings.json` does not exist. Copy `settings_default.json` to `settings.json`, or run `./wacs.exe --version` once to generate it automatically.
2. Following the [win-acme RDS guide](https://www.win-acme.com/manual/advanced-use/examples/rds), edit `settings.json` and set `PrivateKeyExportable` to `true`.

### 3. Prepare DNS Validation

To obtain a certificate from Let's Encrypt, you must prove ownership of your domain. DNS validation is ideal for servers that do not expose ports 80/443.

Check the [supported DNS validation plugins](https://www.win-acme.com/reference/plugins/validation/dns/) to:

- Confirm that win-acme supports your DNS provider
- Obtain the required API credentials (such as an API token)

Using Cloudflare as an example:

1. Log in to the Cloudflare dashboard and create an API Token with DNS edit permissions.
2. Download the Cloudflare validation plugin from the [win-acme Releases page](https://github.com/win-acme/win-acme/releases/).
3. Extract the plugin into the `win-acme` directory following the [Cloudflare plugin documentation](https://www.win-acme.com/reference/plugins/validation/dns/cloudflare).
4. Run `./wacs.exe --verbose` to confirm the plugin loads properly.

### 4. Prepare the Installation Script

Save the script below as `CustomImportRDS.ps1` inside the `Scripts` folder under your `win-acme` directory.

This script is adapted from win-acme's `ImportRDS.ps1` and handles:

- Locating the certificate in the Windows certificate store
- Updating the RDP listener registry key to use the new certificate
- Granting `NETWORK SERVICE` read permission on the certificate's private key

<details>
<summary>CustomImportRDS.ps1 (Click to expand)</summary>

```powershell
<#
.SYNOPSIS
Imports a cert from WACS renewal into the RD Gateway and RD Listener

.DESCRIPTION
Note that this script is intended to be run via the install script plugin from win-acme via the batch script wrapper. As such, we use positional parameters to avoid issues with using a dash in the cmd line.

Proper information should be available here

https://github.com/PKISharp/win-acme/wiki/Install-Script

or more generally, here

https://github.com/PKISharp/win-acme/wiki/Example-Scripts

.PARAMETER NewCertThumbprint
The exact thumbprint of the cert to be imported. The script will copy this cert to the Personal store if not already there.

.EXAMPLE

ImportRDS.ps1 <certThumbprint>

.NOTES

#>

param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$NewCertThumbprint
)

function Write-Log {
    param($Message)
    Write-Host $Message
}

Write-Log "Script started with thumbprint: $NewCertThumbprint"

Write-Log "Searching for certificate in store..."
try {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("My", "LocalMachine")
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
    $CertInStore = $store.Certificates | Where-Object { $_.Thumbprint -eq $NewCertThumbprint } | Select-Object -First 1
    $store.Close()
    Write-Log "Certificate search completed"
}
catch {
    Write-Log "Failed to search for certificate: $($_.Exception.Message)"
    return
}

if ($CertInStore) {
    Write-Log "Certificate found in store"

    # Convert certificate thumbprint to a byte array
    try {
        $ThumbprintBytes = $CertInStore.Thumbprint -replace '([A-Fa-f0-9]{2})', '0x$1' -split '0x' | Where-Object { $_ -ne '' } | ForEach-Object { [byte]('0x' + $_) }
        Write-Log "Thumbprint converted to bytes"
    }
    catch {
        Write-Log "Failed to convert thumbprint: $($_.Exception.Message)"
        return
    }

    # Update HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp\SSLCertificateSHA1Hash
    try {
        Write-Log "Updating registry for RDP listener..."
        Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name 'SSLCertificateSHA1Hash' -Value ([byte[]]$ThumbprintBytes) -ErrorAction Stop
        Write-Log "Registry value for RDP listener updated successfully"
    }
    catch {
        Write-Log "Failed to update registry value for RDP listener: $($_.Exception.Message)"
        return
    }

    # Grant NETWORK SERVICE read access to the certificate private key
    try {
        Write-Log "Adding NETWORK SERVICE permissions to private key..."

        if ($CertInStore.HasPrivateKey) {
            $privateKey = $CertInStore.PrivateKey

            if ($privateKey -and $privateKey.CspKeyContainerInfo) {
                $keyContainerName = $privateKey.CspKeyContainerInfo.UniqueKeyContainerName
                $keyFilePath = Join-Path "C:\ProgramData\Microsoft\Crypto\RSA\MachineKeys" $keyContainerName

                Write-Log "Private key file path: $keyFilePath"

                if (Test-Path $keyFilePath) {
                    $fileInfo = New-Object System.IO.FileInfo($keyFilePath)
                    $fileSecurity = $fileInfo.GetAccessControl()

                    # Create access rule for NETWORK SERVICE
                    $networkServiceSid = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-20")
                    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                        $networkServiceSid,
                        [System.Security.AccessControl.FileSystemRights]::Read,
                        [System.Security.AccessControl.AccessControlType]::Allow
                    )

                    $fileSecurity.AddAccessRule($accessRule)
                    $fileInfo.SetAccessControl($fileSecurity)

                    Write-Log "NETWORK SERVICE permissions added to private key successfully"
                }
                else {
                    Write-Log "Private key file not found at: $keyFilePath"
                }
            }
            else {
                Write-Log "Certificate private key information not available"
            }
        }
        else {
            Write-Log "Certificate does not have a private key"
        }
    }
    catch {
        Write-Log "Failed to add NETWORK SERVICE user to the certificate's private key: $($_.Exception.Message)"
    }
}
else {
    Write-Log "Cert thumbprint not found in the My cert store... have you specified --certificatestore My?"
}

Write-Log "Script completed"
```

</details>

### 5. Request and Install the Certificate

Open Command Prompt or PowerShell **as Administrator**, navigate to the `win-acme` directory, and run:

```powershell
./wacs.exe --source manual --host YOUR_DOMAIN --validation cloudflare --cloudflareapitoken YOUR_API_TOKEN --certificatestore My --installation script --script "Scripts\CustomImportRDS.ps1" --scriptparameters "{CertThumbprint}"
```

Parameter breakdown:

- `--source manual`: Manually specify the domain name.
- `--host YOUR_DOMAIN`: Replace with your actual domain.
- `--validation cloudflare`: DNS validation provider (change if using another provider).
- `--cloudflareapitoken YOUR_API_TOKEN`: Replace with your API token.
- `--certificatestore My`: Store the certificate in the Local Computer Personal store.
- `--installation script`: Install the certificate via a custom script.
- `--script "Scripts\CustomImportRDS.ps1"`: Path to the installation script.
- `--scriptparameters "{CertThumbprint}"`: Passes the certificate thumbprint to the script.

On the first run, win-acme will prompt you to accept the Let's Encrypt terms and enter an email address. Once completed, win-acme will:

1. Create a temporary DNS TXT record to validate domain ownership and issue the Let's Encrypt certificate.
2. Import the certificate into the Windows certificate store.
3. Run the script to bind the certificate to Remote Desktop Services.
4. Register an automatic renewal scheduled task.

## Verification

### Check Certificate Status

1. Press `Win + R`, type `certlm.msc`, and press Enter to open the Local Computer Certificate Manager.
2. Expand **Personal** > **Certificates**.
3. Locate your domain certificate and verify it was imported.
4. Double-click the certificate to verify:
   - The issuer is a Let's Encrypt authority (such as `R11`)
   - The validity period is correct
   - The Common Name matches your domain
5. Right-click the certificate > **All Tasks** > **Manage Private Keys**, and confirm `NETWORK SERVICE` has **Read** permission.

### Test Remote Desktop Connection

1. Connect from another computer using your **domain name** (not the IP address).
2. Confirm that no certificate warning dialog appears.
3. Click the lock icon on the RDP connection bar to verify the new Let's Encrypt certificate is in use.

## Automatic Renewal

win-acme creates a Windows Scheduled Task that automatically renews the certificate before it expires.

To inspect the renewal task:

1. Open Task Scheduler (`Win + R` → `taskschd.msc`).
2. Look under **Task Scheduler Library** for `win-acme renew`.
3. Inspect its schedule and execution history.

## Troubleshooting

If certificate issuance fails, check:

- **DNS validation failure**: Verify your API token permissions and DNS provider settings.
- **Network connectivity**: Ensure the server can reach the Let's Encrypt API.
- **Rate limits**: Let's Encrypt enforces strict rate limits; repeated failed attempts in a short window may be temporarily throttled.
