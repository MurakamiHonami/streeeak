#!/bin/bash
cd /home/ec2-user/streeeak/backend

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt