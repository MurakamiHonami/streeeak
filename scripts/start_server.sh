#!/bin/bash

# Ubuntu環境に合わせてパスとユーザーを修正
cat << 'EOF' > /etc/systemd/system/streeeak-api.service
[Unit]
Description=Streeeak FastAPI Server
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/streeeak/backend
# .venvが存在するか、パスが合っているか確認してください
Environment="PATH=/home/ubuntu/streeeak/backend/.venv/bin:$PATH"
ExecStart=/home/ubuntu/streeeak/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable streeeak-api
systemctl restart streeeak-api