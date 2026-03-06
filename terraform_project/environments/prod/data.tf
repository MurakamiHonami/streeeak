# S3 Buckets

# 静的コンテンツ用S3バケット
resource "aws_s3_bucket" "static_content" {
  bucket = "streeeak-frontend-111"
}


# RDS (Database)

# DB用セキュリティグループ
resource "aws_security_group" "db_sg" {
  name        = "streeeak-rds-sg"
  description = "Security group for Streeeak RDS"
  vpc_id      = aws_vpc.main.id

  # インバウンドルール (Webサーバーからのアクセスを許可)
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# DBサブネットグループ (マルチAZ配置用)
resource "aws_db_subnet_group" "main" {
  name        = "streeeak-db-subnet-group"
  description = "streeeak-db-subnet-group"
  subnet_ids = [
    aws_subnet.public_1a.id,
    aws_subnet.public_1c.id,
    aws_subnet.private_1a.id,
    aws_subnet.public_1d.id
  ]
}

# 5. RDSインスタンス (マルチAZ)
resource "aws_db_instance" "main" {
  identifier                   = "streeeak-db"
  engine                       = "postgres"
  engine_version               = "17.6"
  instance_class               = "db.t3.micro"
  storage_encrypted            = true
  max_allocated_storage        = 1000
  copy_tags_to_snapshot        = true
  performance_insights_enabled = true
  allocated_storage            = 20
  db_subnet_group_name         = aws_db_subnet_group.main.name
  vpc_security_group_ids       = [aws_security_group.db_sg.id]
  multi_az                     = true
  skip_final_snapshot          = true
}