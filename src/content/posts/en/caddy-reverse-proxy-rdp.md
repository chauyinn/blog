---
title: Reverse Proxying RDP with Caddy
published: 2025-05-10
updated: 2025-05-10
description: 'How to reverse proxy RDP traffic using Caddy and the caddy-l4 plugin'
image: ''
tags: [Caddy, Reverse Proxy, RDP, caddy-l4, Remote Desktop]
category: 'Networking'
draft: false
lang: 'en'
---

## Introduction

[Caddy](https://github.com/caddyserver/caddy) is an open-source web server that supports reverse proxying, load balancing, and automatic HTTPS. Its core focus is handling HTTP and HTTPS traffic with automatic SSL/TLS certificate provisioning and management, making it ideal as a web server or reverse proxy. While Caddy does not natively handle the RDP protocol out of the box, you can reverse proxy RDP traffic using the [caddy-l4](https://github.com/mholt/caddy-l4) plugin.

## Installing Caddy

1. Visit the [Caddy Download Page](https://caddyserver.com/download) and select the required plugin to build a custom binary—in this case, the `caddy-l4` plugin.

2. Follow the [official Caddy installation guide](https://caddyserver.com/docs/install) to install Caddy.

## Configuring the RDP Reverse Proxy

Add the following configuration to your `Caddyfile`:

```txt
{
    layer4 {
            :3389 {
                @rdp rdp
                route @rdp {
                    proxy 192.168.1.100:3389
                }
            }
    }
}

fnos.your.domain {
        reverse_proxy 192.168.1.100:5666
}
```

Configuration breakdown:

- `layer4`: Enables the `layer4` module to handle raw TCP/UDP traffic.
- `:3389`: Listens on port `3389` on the local server.
- `@rdp`: Defines a matcher named `@rdp` that matches RDP traffic.
- `route @rdp`: Defines a routing rule to execute when `@rdp` matches.
- `proxy`: Forwards the matched traffic to the target server's RDP port.
