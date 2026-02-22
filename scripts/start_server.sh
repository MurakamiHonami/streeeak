#!/bin/bash
cat << 'EOF' > /etc/systemd/system/streeeak-api.service
[Unit]
Description=Streeeak FastAPI Server
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/streeeak/backend
Environment="PATH=/home/ec2-user/streeeak/backend/.venv/bin:$PATH"
ExecStart=/home/ec2-user/streeeak/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF


systemctl daemon-reload
systemctl enable streeeak-api
systemctl start streeeak-api