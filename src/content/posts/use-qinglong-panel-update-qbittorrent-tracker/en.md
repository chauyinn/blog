---

title: Automatically Updating qBittorrent Trackers with Qinglong Panel
published: 2025-03-31
updated: 2025-03-31
description: 'Use Qinglong Panel and a Python script to automatically fetch and update qBittorrent tracker lists for better BT download speeds'
image: ''
tags: ["qBittorrent", "Qinglong", "qinglong", "Automation", "PT", "BT", "Tracker"]
category: 'Automation'
draft: false
lang: 'en'
---

## Introduction

In BitTorrent networks, trackers help P2P clients discover other peers sharing the same torrent. Keeping your tracker list up to date can noticeably improve peer discovery and download speeds.

Popular public tracker list sources include:

- [https://cf.trackerslist.com/all.txt](https://cf.trackerslist.com/all.txt)
- [https://cf.trackerslist.com/best.txt](https://cf.trackerslist.com/best.txt)

> [!NOTE]
> Starting with qBittorrent 5.1.0, qBittorrent natively supports automatically fetching tracker lists from URLs without any external script. See the [qBittorrent 5.1.0 Changelog](https://github.com/qbittorrent/qBittorrent/blob/da87be2b12893dfb769df8124afeb064f099dc71/Changelog#L7).
>
> If you are running 5.1.0 or newer, you can configure tracker list URLs directly in qBittorrent's settings.

![image](./image.png)

> [!TIP]
> Many Private Tracker (PT) sites require the official qBittorrent client rather than third-party forks (such as [qBittorrent-Enhanced-Edition](https://github.com/c0re100/qBittorrent-Enhanced-Edition)).

## Script Features

- **Multiple sources**: Fetches the latest trackers from multiple URLs.
- **Custom trackers**: Supports appending your own custom tracker URLs.
- **Deduplication**: Automatically deduplicates and sorts trackers.

## Prerequisites

### Install Qinglong Panel

[Qinglong Panel](https://qinglong.online/) is a scheduled task manager supporting Python, Node.js, and Shell scripts.

Deploy it with Docker ([installation guide](https://qinglong.online/guide/getting-started/installation-guide/docker)):

```bash
docker run -dit -v $PWD/ql/data:/ql/data -p 5700:5700 -e QlBaseUrl="/" -e QlPort="5700" --name qinglong --hostname qinglong --restart unless-stopped whyour/qinglong:latest
```

Once running, open `http://<server-ip>:5700` in your browser to finish initial setup:

1. Set an administrator username and password.
2. Log in to the Qinglong dashboard.

### Enable qBittorrent WebUI (Enabled by Default in Docker)

In qBittorrent:

1. Go to **Tools → Options → Web UI**.
2. Enable **Web User Interface (Remote control)**.
3. Set a username and password.
4. Note the WebUI URL (e.g., `http://192.168.1.100:8080`).

## Configuration

### 1. Install Python Dependencies

1. Open **Dependencies** in Qinglong Panel.
2. Click **+** in the top-right corner.
3. Choose **Python3**, enter `qbittorrent-api` as the name, and keep the remaining defaults.
4. Click **OK** to install, and check the logs to confirm success.

### 2. Add the Script

1. Open **Scripts** in Qinglong Panel.
2. Click **+** to create a new file named `qbittorrent_tracker_updater.py`.
3. Paste the following code and save:

<details>
<summary>qbittorrent_tracker_updater.py (Click to expand)</summary>

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch BT tracker lists from multiple sources and update qBittorrent preferences.

Required pip package:
- qbittorrent-api
"""

import os
import sys
import logging
from typing import List

import requests
import qbittorrentapi


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("qbittorrent_trackers_updater")


def get_environment_config() -> tuple:
    """Read configuration from environment variables"""
    qb_url = os.environ.get("QBITTORRENT_URL")  # e.g. "http://192.168.1.100:8080"
    qb_username = os.environ.get("QBITTORRENT_USER")  # e.g. "admin"
    qb_password = os.environ.get("QBITTORRENT_PASSWORD")  # e.g. "adminpassword"

    # Semicolon-separated list of tracker list URLs
    # e.g. "https://cf.trackerslist.com/all.txt;https://cf.trackerslist.com/best.txt"
    tracker_urls = os.environ.get("QBITTORRENT_tracker_URLS")

    # Semicolon-separated list of custom trackers
    # e.g. "udp://tracker.example1.com:6969;udp://tracker.example2.com:6969"
    custom_trackers = os.environ.get("QBITTORRENT_CUSTOM_trackerS", "")

    default_tracker_url = "https://cf.trackerslist.com/all.txt"
    if not tracker_urls:
        tracker_urls = default_tracker_url

    return qb_url, qb_username, qb_password, tracker_urls, custom_trackers


def fetch_trackers(urls: List[str]) -> List[str]:
    """Fetch tracker lists from the specified URLs"""
    logger.info("Fetching tracker lists...")
    all_trackers = []

    for url in urls:
        logger.info(f"Fetching trackers from {url}...")

        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                new_trackers = [
                    tracker for tracker in response.text.strip().split("\n")
                    if tracker.strip()
                ]

                if new_trackers:
                    all_trackers.extend(new_trackers)
                    logger.info(f"Successfully fetched tracker list from {url}")
                else:
                    logger.warning(f"Empty tracker list returned from {url}")
            else:
                logger.error(f"Failed to fetch from {url}, HTTP status: {response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            continue

    return all_trackers


def add_custom_trackers(all_trackers: List[str], custom_trackers: str) -> List[str]:
    """Append custom trackers to the fetched list"""
    if not custom_trackers:
        return all_trackers

    custom_trackers_list = [
        tracker for tracker in custom_trackers.split(";") if tracker.strip()
    ]
    if custom_trackers_list:
        all_trackers.extend(custom_trackers_list)
        logger.info("Added custom trackers")

    return all_trackers


def update_qbittorrent_trackers(
    qb_url: str,
    qb_username: str,
    qb_password: str,
    unique_trackers: List[str]
) -> bool:
    """Update qBittorrent tracker preferences"""
    if not all([qb_url, qb_username, qb_password]):
        logger.error("Error: Incomplete qBittorrent configuration. Check environment variables.")
        return False

    client = None
    try:
        logger.info("Connecting to qBittorrent...")
        client = qbittorrentapi.Client(
            host=qb_url,
            username=qb_username,
            password=qb_password
        )

        client.auth_log_in()

        version = client.app_version()
        logger.info(f"qBittorrent version: {version}")

        trackers_str = "\n".join(unique_trackers)

        logger.info("Updating trackers...")
        client.app_set_preferences({
            "add_trackers_enabled": True,
            "add_trackers": trackers_str
        })

        logger.info("Trackers updated successfully")
        return True

    except qbittorrentapi.LoginFailed as e:
        logger.error(f"qBittorrent login failed: {str(e)}")
        return False
    except qbittorrentapi.APIConnectionError as e:
        logger.error(f"qBittorrent API connection error: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return False
    finally:
        try:
            if client is not None:
                client.auth_log_out()
        except Exception:
            pass


def main() -> int:
    qb_url, qb_username, qb_password, tracker_urls_str, custom_trackers = get_environment_config()

    tracker_urls = [url.strip()
                    for url in tracker_urls_str.split(";") if url.strip()]

    all_trackers = fetch_trackers(tracker_urls)

    if not all_trackers:
        logger.error("Failed to fetch trackers from all URLs, exiting")
        return 1

    all_trackers = add_custom_trackers(all_trackers, custom_trackers)
    unique_trackers = sorted(set(all_trackers))

    logger.info(f"Collected {len(unique_trackers)} unique trackers")

    success = update_qbittorrent_trackers(
        qb_url, qb_username, qb_password, unique_trackers)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
```

</details>

### 3. Configure Environment Variables

In Qinglong Panel, open **Environment Variables** and add:

Required variables:

- `QBITTORRENT_URL`: Your qBittorrent WebUI URL (e.g., `http://192.168.1.100:8080`)
- `QBITTORRENT_USER`: qBittorrent WebUI username
- `QBITTORRENT_PASSWORD`: qBittorrent WebUI password

Optional variables:

- `QBITTORRENT_tracker_URLS`: Semicolon-separated tracker list URLs (e.g., `https://cf.trackerslist.com/all.txt;https://cf.trackerslist.com/best.txt`)
- `QBITTORRENT_CUSTOM_trackerS`: Semicolon-separated custom tracker URLs (e.g., `udp://tracker.example1.com:6969;udp://tracker.example2.com:6969`)

### 4. Create a Scheduled Task

1. Open **Scheduled Tasks** in Qinglong Panel and click **+**.
2. Fill in:
   - **Name**: `Update qBittorrent Trackers`
   - **Command**: `task qbittorrent_tracker_updater.py`
   - **Schedule**: `0 7 * * *` (runs daily at 7:00 AM)
3. Save the task.

### 5. Test the Task

Click **Run** next to the newly created task and inspect the log output:

```
## Starting... 2025-03-31 22:37:22

2025-03-31 22:37:23 - INFO - Fetching tracker lists...
2025-03-31 22:37:23 - INFO - Fetching trackers from https://cf.trackerslist.com/all.txt...
2025-03-31 22:37:24 - INFO - Successfully fetched tracker list from https://cf.trackerslist.com/all.txt
2025-03-31 22:37:24 - INFO - Collected 157 unique trackers
2025-03-31 22:37:24 - INFO - Connecting to qBittorrent...
2025-03-31 22:37:24 - INFO - qBittorrent version: v5.0.4
2025-03-31 22:37:24 - INFO - Updating trackers...
2025-03-31 22:37:24 - INFO - Trackers updated successfully

## Finished... 2025-03-31 22:37:24  Elapsed: 2s
```

## Troubleshooting

1. **Connection errors**: Verify qBittorrent WebUI is enabled and that the URL, username, and password are correct.
2. **Missing dependencies**: Confirm `qbittorrent-api` installed cleanly under Qinglong's Python3 dependencies.
3. **Permissions**: Make sure the qBittorrent account has permission to update preferences.
4. **Unreachable tracker URL**: Override the default list using `QBITTORRENT_tracker_URLS`.
5. **Logs**: Check the task execution log in Qinglong Panel for detailed error output.
