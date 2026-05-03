# ExitPing

<div align="center">
<img src="assets/readme/banner.png" width=700>
</div>

**Real-time network monitoring from your system tray**

A lightweight Windows app that delivers accurate internet speed measurements with professional-grade connection insights in a minimal interface.

<img src="assets/readme/preview.png" width=500>

## Features

**Smart Testing**  
Dynamic node discovery finds the optimal test server based on your location

**Accurate Metrics**  
Median-filtered measurements eliminate spikes for consistent results

**Network Inspector**  
Deep insights: jitter, packet loss, connection grade, IP, and ISP details

**Game Server Monitoring**  
Live latency to Valorant, CS2, and League of Legends data centers

**Auto Updates**  
Silent background checks with clean update notifications

## Installation

Download the latest release from [Releases](https://github.com/ash-kernel/exitping/releases)

> the software does not have a cerficate which means windows might flag it has virus.

**Requirements:** Windows 10+ (64-bit)

## Usage

1. Launch ExitPing
2. Click **Start** to begin testing
3. Open the inspector (→) for detailed metrics
4. View game server latency in the inspector panel

## Metrics

| Metric | What it measures |
|--------|------------------|
| Download/Upload | Transfer speed (Mbps) |
| Latency | Response time to server (ms) |
| Jitter | Latency variance |
| Loss | Packet loss percentage |
| Grade | Overall connection quality (A+ to D) |

## Settings

- Start at login
- Auto-test on open

## Troubleshooting

**Tests timing out?**  
Check your firewall settings for TCP connections (Port 8080/443)

**Inaccurate results?**  
Close bandwidth-heavy applications during testing

---

[Ash-kernel](https://github.com/ash-kernel) • © 2026 ExitPing