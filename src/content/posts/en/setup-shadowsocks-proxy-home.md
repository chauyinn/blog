---

title: Setting Up a Shadowsocks Proxy to Connect Home
published: 2025-03-23
updated: 2025-03-23
description: 'Deploy a secure Shadowsocks server on your home network with Docker to remotely access LAN services'
image: ''
tags: ["Docker", "Proxy", "Networking", "Shadowsocks"]
category: 'Networking'
draft: false
lang: 'en'
---

## Introduction

When you are away from home, you may need to access local services on your home LAN that you do not want to expose directly to the public internet. By setting up a Shadowsocks proxy, you can "tunnel home" and reach those resources as if you were on your local network. Compared to WireGuard, Shadowsocks pairs easily with rule-based proxy clients for fine-grained traffic routing.

## Prerequisites

- A device on your home network with a public IP address (IPv4 or IPv6)
- Docker installed on that device
- Port `8388` (or your chosen custom port) open on the device and its router/firewall

## Installing the Shadowsocks Server

First, create a directory for the configuration file:

```bash
mkdir -p ~/ss-server && cd ~/ss-server
```

Create `config.json`:

```json
{
	"server": "::",
	"server_port": 8388,
	"password": "your_strong_password_here",
	"method": "chacha20-ietf-poly1305",
	"mode": "tcp_and_udp"
}
```

Start the Shadowsocks server container:

```bash
docker run -d --name ss-server --restart always --network host \
  -v ~/ss-server/config.json:/etc/shadowsocks-rust/config.json \
  ghcr.io/shadowsocks/ssserver-rust:latest
```

> **Security Tip**: Always replace `password` with a strong, unique password—never leave the default value!

## Installing a Shadowsocks Client

Choose a client for your device:

- **Android**:
  - [Shadowsocks Android](https://github.com/shadowsocks/shadowsocks-android/releases)
  - [v2rayNG](https://github.com/2dust/v2rayNG/releases)

- **Windows**:
  - [Shadowsocks Windows](https://github.com/shadowsocks/shadowsocks-windows/releases)
  - [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev/releases)

## Client Configuration

Using Shadowsocks for Android as an example:

1. Open the Shadowsocks app.
2. Tap `+` in the top-right corner to add a profile.
3. Fill in the connection details manually:
   - **Profile Name**: Any label (e.g. `Home Network`)
   - **Server**: Your server's public IP address
   - **Remote Port**: `8388` (or your custom port)
   - **Password**: The password configured on the server
   - **Encrypt Method**: `chacha20-ietf-poly1305`
   - **Route**: Global (or customize as needed)
4. Save and activate the profile.

## Testing the Connection

1. Connect your client to the Shadowsocks server.
2. Try accessing resources on your home network, such as:
   - Internal LAN services
   - Your NAS web interface

## Troubleshooting

### Cannot Connect

- Verify that port `8388` is open on both the host firewall and your router.
- Confirm that the password and encryption method match on both server and client.
- Check server logs with: `docker logs ss-server`.

### Slow Connection

- Try switching the cipher to `aes-256-gcm`.
- Check your home upload bandwidth limits.
- Verify network routing quality between your client and home ISP.
