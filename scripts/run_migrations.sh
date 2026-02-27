#!/bin/bash
set -e

echo "Running database migrations..."
cd /home/ec2-user/streeeak/backend

# 仮想環境のPythonを使ってAlembicを実行
sudo -u ec2-user /home/ec2-user/streeeak/backend/.venv/bin/alembic upgrade head

echo "Migrations completed successfully."