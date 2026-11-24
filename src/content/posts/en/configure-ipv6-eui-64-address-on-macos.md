---

title: Configuring an IPv6 EUI-64 Address on macOS
published: 2025-04-14
updated: 2025-04-14
description: 'Use a Python script and LaunchDaemon on macOS to configure a static IPv6 EUI-64 interface identifier for reliable remote access'
image: ''
tags: ["macOS", "IPv6", "Networking", "EUI-64", "Automation", "Python"]
category: 'System Optimization'
draft: false
lang: 'en'
---

## Introduction

macOS generates IPv6 addresses according to [RFC 7217](https://www.rfc-editor.org/rfc/rfc7217), using privacy-preserving opaque identifiers rather than deriving a fixed suffix directly from the MAC address. Like Android, macOS primarily obtains IPv6 addresses via [SLAAC](https://en.wikipedia.org/wiki/IPv6#Stateless_address_autoconfiguration_(SLAAC)) (Stateless Address Autoconfiguration). Although macOS technically supports [DHCPv6](https://en.wikipedia.org/wiki/DHCPv6), SLAAC is still preferred in most networks (and Android does not support DHCPv6 at all). When using a Mac as a remote server reachable only over public IPv6, configuring an EUI-64 address keeps the IPv6 host suffix fixed, enabling stable and reliable remote access.

While you can use [DDNS-GO](https://github.com/jeessy2/ddns-go) on macOS to bind a dynamic IPv6 address to a domain name, that approach has limitations:

- The address suffix is not fixed (due to RFC 7217), requiring frequent firewall rule adjustments.
- It depends on the reliability of third-party DDNS services.
- DNS propagation can introduce delays.

This guide shows how to use a Python script on macOS to configure an IPv6 EUI-64 address with a fixed suffix for stable remote access.

## Script Implementation

> [!NOTE]
> The script was primarily generated with AI assistance.

The following Python script automatically retrieves the system's IPv6 prefix, computes the EUI-64 address from the interface's MAC address, and applies it as an alias:

<details>
<summary>Python Script (Click to expand)</summary>

```python
import subprocess
import os
import re
import argparse
import time

def get_ipv6_prefix_from_system():
    """Retrieve autoconfigured IPv6 prefixes from macOS"""
    try:
        # List all network interfaces
        result = subprocess.run(['ifconfig'], capture_output=True, text=True, check=True)
        interfaces_output = result.stdout
        
        # Parse interface names
        interface_pattern = re.compile(r'^(\w+):.*$', re.MULTILINE)
        interfaces = interface_pattern.findall(interfaces_output)
        
        prefixes = []
        processed_prefixes = set()

        for interface in interfaces:
            # Skip loopback and tunnel interfaces
            if interface == 'lo0' or interface.startswith('utun'):
                continue
                
            if_result = subprocess.run(['ifconfig', interface], capture_output=True, text=True, check=True)
            if_output = if_result.stdout
            
            # Match IPv6 addresses marked as autoconf secured or autoconf temporary
            ipv6_pattern = re.compile(r'inet6\s+([a-f0-9:]+)(%\w+)?\s+prefixlen\s+(\d+).*?(autoconf secured|autoconf temporary)', re.IGNORECASE)
            ipv6_addresses = ipv6_pattern.findall(if_output)
            
            for addr_info in ipv6_addresses:
                addr = addr_info[0]
                prefix_length = int(addr_info[2])
                autoconf_type = addr_info[3]
                
                # Skip link-local addresses
                if addr.startswith('fe80:'):
                    continue
                
                if prefix_length == 64:
                    prefix_parts = addr.split(':')[:4]
                    prefix = ':'.join(prefix_parts)
                    
                    prefix_key = f"{interface}_{prefix}"
                    if prefix_key in processed_prefixes:
                        continue
                    
                    processed_prefixes.add(prefix_key)
                    
                    prefixes.append({
                        'interface': interface,
                        'prefix': prefix,
                        'prefix_length': 64,
                        'full_addr': addr,
                        'type': autoconf_type
                    })
                    
        return prefixes
    except Exception as e:
        return f"Error getting IPv6 prefix: {e}"

def wait_for_ipv6_prefix(interface=None, max_attempts=12, wait_time=10):
    """Wait until an IPv6 prefix becomes available"""
    print(f"Waiting for IPv6 prefix{' (interface: ' + interface + ')' if interface else ''}...")
    
    for attempt in range(1, max_attempts + 1):
        prefixes = get_ipv6_prefix_from_system()
        
        if isinstance(prefixes, list) and prefixes:
            if interface:
                interface_prefixes = [p for p in prefixes if p['interface'] == interface]
                if interface_prefixes:
                    print(f"Obtained IPv6 prefix on attempt {attempt}")
                    return prefixes
            else:
                print(f"Obtained IPv6 prefix on attempt {attempt}")
                return prefixes
        
        print(f"Attempt {attempt}/{max_attempts}: no IPv6 prefix found, retrying in {wait_time}s...")
        time.sleep(wait_time)
    
    print(f"Timed out: failed to obtain IPv6 prefix after {max_attempts} attempts")
    return []

def get_mac_address(interface):
    """Get the MAC address for the given network interface"""
    try:
        result = subprocess.run(['ifconfig', interface], capture_output=True, text=True, check=True)
        output = result.stdout
        
        mac_pattern = re.compile(r'ether\s+([0-9a-f:]{17})', re.IGNORECASE)
        match = mac_pattern.search(output)
        
        if match:
            return match.group(1)
        return None
    except:
        return None

def mac_to_eui64(mac, prefix):
    """Convert a MAC address and /64 prefix into an EUI-64 IPv6 address"""
    mac = mac.replace(':', '')

    # Insert FFFE in the middle of the MAC address
    eui64 = mac[0:6] + 'fffe' + mac[6:]

    eui64_bytes = bytearray.fromhex(eui64)

    # Flip the 7th bit (Universal/Local bit)
    eui64_bytes[0] ^= 0b00000010

    modified_eui64 = ''.join(f'{b:02x}' for b in eui64_bytes)

    eui64_parts = [modified_eui64[i:i+4]
                   for i in range(0, len(modified_eui64), 4)]

    prefix_parts = prefix.split(':')
    while '' in prefix_parts:
        prefix_parts.remove('')

    # Keep only the first 4 hextets (64 bits) of the prefix
    prefix_parts = prefix_parts[:4]

    ipv6_parts = prefix_parts + eui64_parts
    ipv6_address = ':'.join(ipv6_parts)

    return ipv6_address

def add_eui64_address(interface, eui64_ipv6):
    """Add the EUI-64 IPv6 address as an alias on the specified interface"""
    if os.geteuid() != 0:
        return "Administrator privileges are required. Please run this script with sudo."

    try:
        subprocess.run(['ifconfig', interface, 'inet6', eui64_ipv6, 'prefixlen', '64', 'alias'],
                      check=True, capture_output=True)

        return f"Successfully added EUI-64 address {eui64_ipv6} to interface {interface}"
    except subprocess.CalledProcessError as e:
        return f"Error adding IPv6 address: {e}"
    except Exception as e:
        return f"Unexpected error: {e}"

def main():
    parser = argparse.ArgumentParser(description='Retrieve IPv6 prefix from macOS and add an EUI-64 address')
    parser.add_argument('--interface', help='Target network interface to configure')
    parser.add_argument('--apply', action='store_true', help='Automatically apply the generated EUI-64 address')
    parser.add_argument('--retry', type=int, default=12, help='Maximum retry attempts (default: 12)')
    parser.add_argument('--wait', type=int, default=10, help='Seconds to wait between retries (default: 10)')

    args = parser.parse_args()

    print("Fetching IPv6 prefix from system...")
    
    if args.apply:
        prefixes = wait_for_ipv6_prefix(args.interface, args.retry, args.wait)
    else:
        prefixes = get_ipv6_prefix_from_system()

    if isinstance(prefixes, str):
        print(prefixes)
        return

    if not prefixes:
        print("No IPv6 prefix found. Make sure your network supports IPv6.")
        return

    print(f"Found {len(prefixes)} IPv6 prefix(es)")

    results = []

    for prefix_info in prefixes:
        interface = prefix_info['interface']
        prefix = prefix_info['prefix']

        mac = get_mac_address(interface)
        if not mac:
            print(f"No MAC address found for interface {interface}")
            continue

        eui64_address = mac_to_eui64(mac, prefix)

        results.append({
            'interface': interface,
            'prefix': prefix,
            'mac': mac,
            'current_ipv6': prefix_info['full_addr'],
            'eui64_ipv6': eui64_address
        })

    for i, result in enumerate(results, 1):
        print(f"\n{i}. Interface: {result['interface']}")
        print(f"   MAC Address: {result['mac']}")
        print(f"   IPv6 Prefix: {result['prefix']}/64")
        print(f"   Current IPv6: {result['current_ipv6']}")
        print(f"   EUI-64 IPv6: {result['eui64_ipv6']}")
        print(f"   \n   To add this address manually, run:")
        print(
            f"   sudo ifconfig {result['interface']} inet6 {result['eui64_ipv6']} prefixlen 64 alias")

    if args.apply:
        if os.geteuid() != 0:
            print("\nAdministrator privileges are required. Please run with sudo.")
            return

        selected_interface = args.interface
        selected_result = None

        if selected_interface:
            selected_results = [
                r for r in results if r['interface'] == selected_interface]
            if selected_results:
                selected_result = selected_results[0]
            else:
                print(f"\nSpecified interface not found: {selected_interface}")
                return
        elif results:
            selected_result = results[0]
        else:
            print("\nNo configurable interface found")
            return

        print(f"\nAdding EUI-64 address to interface {selected_result['interface']}...")
        result = add_eui64_address(
            selected_result['interface'], selected_result['eui64_ipv6'])
        print(result)

        print("\nCurrent interface status:")
        subprocess.run(['ifconfig', selected_result['interface']], check=False)

if __name__ == "__main__":
    main()
```

</details>

## Usage

### Running Manually

Preview available IPv6 prefixes and their corresponding EUI-64 addresses:

```bash
python3 add_eui64.py
```

Automatically apply the EUI-64 address (requires root privileges):

```bash
sudo python3 add_eui64.py --apply
```

Apply the EUI-64 address to a specific interface:

```bash
sudo python3 add_eui64.py --apply --interface en0
```

Customize retry parameters (e.g., up to 24 attempts, waiting 5 seconds each):

```bash
sudo python3 add_eui64.py --apply --interface en0 --retry 24 --wait 5
```

### Using with DDNS-GO

If you already use [DDNS-GO](https://github.com/jeessy2/ddns-go), you can extract the current IPv6 prefix and append your fixed EUI-64 suffix using a command:

```bash
ifconfig | grep "autoconf secured\|autoconf temporary" | awk '{print $2}' | awk -F: '{print $1":"$2":"$3":"$4}' | head -n 1 | xargs -I{} echo "{}:ffff:ffff:ffff:ffff"
```

Replace `ffff:ffff:ffff:ffff` with the actual EUI-64 interface identifier generated for your device.

## Setting Up an Automated Service

To ensure the EUI-64 address persists across reboots and network prefix changes, configure a scheduled `LaunchDaemon`:

### 1. Install the Script

Copy the script to `/usr/local/bin/` and set executable permissions:

```bash
sudo cp add_eui64.py /usr/local/bin/
sudo chmod 755 /usr/local/bin/add_eui64.py
```

### 2. Create the LaunchDaemon Configuration

Create a `.plist` file to define the service arguments and schedule:

```bash
sudo nano /Library/LaunchDaemons/com.eui64.plist
```

Add the following content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.eui64</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/usr/local/bin/add_eui64.py</string>
        <string>--apply</string>
        <string>--interface</string>
        <string>en0</string>
        <string>--retry</string>
        <string>12</string>
        <string>--wait</string>
        <string>10</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/dev/null</string>
    <key>StandardOutPath</key>
    <string>/dev/null</string>
</dict>
</plist>
```

> [!NOTE]
> Replace `en0` with your actual network interface name.
>
> Regarding logs: discarding output via `/dev/null` (or logging to `/tmp`) prevents log files from growing indefinitely over time.

### 3. Set Permissions and Load the Service

```bash
sudo chown root:wheel /Library/LaunchDaemons/com.eui64.plist
sudo chmod 644 /Library/LaunchDaemons/com.eui64.plist
sudo launchctl load /Library/LaunchDaemons/com.eui64.plist
```

The service will now run automatically at boot and every hour thereafter, keeping the EUI-64 address active.

## Verification

### Check Service Status

Confirm the daemon is loaded:

```bash
sudo launchctl list | grep com.eui64
```

You should see output similar to:

```
-   0   com.eui64
```

### Verify the IPv6 Address

Check whether the EUI-64 address has been added to your interface:

```bash
ifconfig en0 | grep inet6
```

You should see two types of non-link-local IPv6 addresses:

1. System-autoconfigured privacy addresses (marked with `autoconf`)
2. Your newly added EUI-64 address

## Troubleshooting

### Address Not Added

If the EUI-64 address does not appear, check the following:

- **Insufficient permissions**: Ensure the script is executed as root.
- **No IPv6 connectivity**: Verify that your network provides IPv6.
- **Wrong interface name**: Double-check the interface identifier (e.g., `en0`, `en1`).

### Service Fails to Start

If the LaunchDaemon fails to run:

- Temporarily point `StandardErrorPath` / `StandardOutPath` to a log file to inspect errors.
- Confirm Python 3 is installed at `/usr/bin/python3`.
- Verify the script path and file permissions.
