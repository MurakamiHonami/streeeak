#!/bin/bash
systemctl is-active --quiet streeeak-api && systemctl stop streeeak-api || true