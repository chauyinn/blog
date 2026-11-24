---

title: Disabling Randomized IPv6 Identifiers on Windows 11
published: 2025-03-23
updated: 2025-03-23
description: 'Fix the issue where disabling IPv6 RandomizeIdentifiers resets after reboot on Windows 11 using Task Scheduler'
image: ''
tags: ["Windows", "Networking", "IPv6", "EUI-64"]
category: 'System Optimization'
draft: false
lang: 'en'
---

## Introduction

Windows 11 enables IPv6 randomized interface identifiers (`RandomizeIdentifiers`) by default as a privacy protection against tracking. However, in scenarios such as accessing a home server via Remote Desktop, a fixed IPv6 host suffix is much more convenient.

Windows provides `Set-NetIPv6Protocol -RandomizeIdentifiers Disabled` to turn off randomized identifiers, but on recent Windows 11 builds the setting reverts to enabled after a reboot. Related discussions:

- [Microsoft Q&A: IPv6 settings not remaining after reboot](https://learn.microsoft.com/en-us/answers/questions/1130080/IPv6-settings-not-remaing-after-reboot)
- [Reddit: Windows 11 reverts IPv6 EUI-64 address back to random](https://www.reddit.com/r/IPv6/comments/1el83oy/IPv6_eui64_address_non_random_windows_11_reverts/)

## Symptoms

Suppose your network adapter's MAC address is `28:cf:e9:12:5d:fe`. With `RandomizeIdentifiers` enabled, the same machine gets different IPv6 suffixes over time:

- Under prefix `2001:db8::/64`: **3725:f4b2:a198:e3d4**
- Under prefix `2001:db8::/64`: **8f12:c637:92ae:5b19** (after reboot)

With `RandomizeIdentifiers` disabled, the IPv6 address keeps a stable MAC-derived suffix:

- Under prefix `2001:db8::/64`: **2acf:e9ff:fe12:5dfe** (derived from the MAC address)

:::tip[How IPv6 EUI-64 Interface Identifiers Work]

When randomization is disabled, Windows derives the IPv6 interface identifier from the MAC address using EUI-64:

1. Start with the MAC address (e.g., `28:cf:e9:12:5d:fe`).
2. Insert `ff:fe` in the middle: `28:cf:e9:ff:fe:12:5d:fe`.
3. Flip the 7th bit (Universal/Local bit): `28` in binary is `00101000`, which becomes `00101010` (`2a`).
4. Final interface identifier: `2acf:e9ff:fe12:5dfe`.

This produces a predictable IPv6 address that simplifies network management, though with reduced privacy.
:::

## Solution

Use Windows Task Scheduler to run the command automatically at system startup so `RandomizeIdentifiers` stays disabled after every reboot.

### 1. Create a Scheduled Task

1. Press `Win + R`, type `taskschd.msc`, and press Enter.
2. Right-click **Task Scheduler Library** and choose **Create Task**.
3. On the **General** tab:
   - **Name**: `Disable IPv6 RandomizeIdentifiers`
   - Select **Run whether user is logged on or not**
   - Check **Run with highest privileges**
4. On the **Triggers** tab:
   - Click **New**, select **At startup**, and click **OK**.
5. On the **Actions** tab:
   - Click **New**
   - **Program/script**: `powershell.exe`
   - **Add arguments**: `-Command "Set-NetIPv6Protocol -RandomizeIdentifiers Disabled"`
   - Click **OK**.
6. Click **OK** to save the task (enter administrator credentials if prompted).

### 2. Verify the Configuration

Run the task manually or reboot your computer, then verify:

1. Open PowerShell after rebooting.
2. Run: `Get-NetIPv6Protocol | Select RandomizeIdentifiers`
3. Confirm the output shows `Disabled`.

Once it shows `Disabled`, your IPv6 address suffix will remain fixed across reboots.
