---

title: Practical Tailscale Networking Tips
published: 2026-03-12
updated: 2026-03-12
description: 'Useful Tailscale tips including subnet routing, exit nodes, transparent side-router setup, and automatic logout on Windows shutdown'
image: ''
tags: ["Tailscale", "Networking", "Mesh Networking", "VPN"]
category: 'Networking'
draft: false
lang: 'en'
---

## Installation

[Tailscale](https://tailscale.com/download) provides installers for all major platforms—simply follow the instructions for your OS.

On Windows, you can install it via `winget`:

```bash
winget install Tailscale.Tailscale
```

## Basic Configuration

Suppose my LAN gateway is `192.168.5.1` and Tailscale is running inside an LXC container on the `192.168.5.0/24` subnet. Running the following command allows other remote Tailscale devices to access services across `192.168.5.0/24`:

```bash
tailscale up --advertise-routes=192.168.5.0/24 --accept-routes --advertise-exit-node
```

Flag breakdown:

- `--advertise-routes=192.168.5.0/24`: Advertises your local subnet to the Tailscale tailnet so remote Tailscale devices can reach services in `192.168.5.0/24`.
- `--accept-routes`: Accepts subnet routes advertised by other nodes. For example, if another node advertises `192.168.100.0/24`, devices in `192.168.5.0/24` can reach `192.168.100.0/24` as well (bidirectional site-to-site access).
- `--advertise-exit-node`: Advertises this node as an exit node so other devices can route all of their internet traffic through it, similar to a full-tunnel VPN.

### Approving Routes in the Admin Console

After enabling subnet routes or an exit node, you must approve those permissions for the device in the Tailscale Admin Console before they take effect.

![tailscale accept](./accept_routes.png)

### Using Tailscale as a Transparent Side Router

If you want devices on your LAN to reach your Tailscale network transparently—without installing the Tailscale client on every device—you can turn a Tailscale node into a side router. For instance, on a small Armbian box running Tailscale, apply the following additional configuration:

```bash
# Enable IPv4 and IPv6 forwarding so the device can route packets between interfaces (e.g. eth0 <-> tailscale0)
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf

# Reload sysctl immediately
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf

# Add an iptables MASQUERADE rule so outbound traffic over tailscale0 appears to originate from this side router.
# Without MASQUERADE, the remote LXC node sees your private LAN IP (192.168.100.x) and has no route back to it.
iptables -t nat -A POSTROUTING -o tailscale0 -j MASQUERADE
```

On LAN devices, point their default gateway to the Tailscale side router's IP (e.g., `192.168.100.41`).

Alternatively, if you have admin access to your main router, you can add a static route pointing the remote subnet to the side router's IP so you don't need to change any LAN client's gateway:

![openwrt routes](./openwrt_routes.png)
<div class="text-center">Configuring a static route on OpenWrt to forward target subnet traffic through the Tailscale side router</div>

With this setup, devices in `192.168.100.x` can transparently reach devices in `192.168.5.x` across separate networks.

### Checking Connection Status

Check peer connectivity and whether connections are direct (P2P) or relayed (DERP):

```bash
tailscale status
```

![tailscale status](./status.png)

### Auto-Logout from Tailscale on Windows Shutdown

If you use Tailscale on a work PC and don't want it to stay signed in after you leave, create a batch script and register it under **User Configuration → Windows Settings → Scripts (Logon/Logoff)** in `gpedit.msc` (via `Win + R`). Every time you log off or shut down, it will automatically log out of Tailscale:

```bat
@echo off
echo [%date% %time%] Starting Tailscale logout... > C:\tailscale_logout.log
"C:\Program Files\Tailscale\tailscale.exe" logout
echo [%date% %time%] Logout command finished. >> C:\tailscale_logout.log
```

## Conclusion

I have used both Shadowsocks and WireGuard before, and both require a public IP for direct access. By contrast, Tailscale automatically falls back to DERP relays when needed and establishes direct P2P hole-punched connections whenever the network allows, offering strong security with far less configuration overhead.
