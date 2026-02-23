#!/bin/bash
cd /home/ubuntu/streeeak/backend

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt