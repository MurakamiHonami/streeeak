# ==========================================
# S3 Buckets
# ==========================================

# 静的コンテンツ用S3バケット
resource "aws_s3_bucket" "static_content" {
  bucket = "streeeak-frontend-111"
}


# ==========================================
# DynamoDB Tables (Serverless Database)
# ==========================================

# 1. Users テーブル
resource "aws_dynamodb_table" "users" {
  name         = "streeeak-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "email"
    type = "S"
  }

  # メールアドレスでのユーザー検索用
  global_secondary_index {
    name               = "EmailIndex"
    hash_key           = "email"
    projection_type    = "ALL"
  }
}

# 2. UserSettings テーブル (Userと1対1)
resource "aws_dynamodb_table" "user_settings" {
  name         = "streeeak-user-settings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id" # 1対1なのでuser_idをそのままプライマリキーに

  attribute {
    name = "user_id"
    type = "S"
  }
}

# 3. Blocks テーブル
resource "aws_dynamodb_table" "blocks" {
  name         = "streeeak-blocks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "blocked_user_id"
    type = "S"
  }

  global_secondary_index {
    name               = "UserIdIndex"
    hash_key           = "user_id"
    projection_type    = "ALL"
  }
  global_secondary_index {
    name               = "BlockedUserIdIndex"
    hash_key           = "blocked_user_id"
    projection_type    = "ALL"
  }
}

# 4. Friendships テーブル
resource "aws_dynamodb_table" "friendships" {
  name         = "streeeak-friendships"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "friend_id"
    type = "S"
  }

  global_secondary_index {
    name               = "UserIdIndex"
    hash_key           = "user_id"
    projection_type    = "ALL"
  }
  global_secondary_index {
    name               = "FriendIdIndex"
    hash_key           = "friend_id"
    projection_type    = "ALL"
  }
}

# 5. Goals テーブル
resource "aws_dynamodb_table" "goals" {
  name         = "streeeak-goals"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name               = "UserIdIndex"
    hash_key           = "user_id"
    projection_type    = "ALL"
  }
}

# 6. Tasks テーブル
resource "aws_dynamodb_table" "tasks" {
  name         = "streeeak-tasks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "goal_id"
    type = "S"
  }

  global_secondary_index {
    name               = "UserIdIndex"
    hash_key           = "user_id"
    projection_type    = "ALL"
  }
  global_secondary_index {
    name               = "GoalIdIndex"
    hash_key           = "goal_id"
    projection_type    = "ALL"
  }
}

# 7. Groups テーブル
resource "aws_dynamodb_table" "groups" {
  name         = "streeeak-groups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "owner_id"
    type = "S"
  }

  # オーナーからグループを検索できるようにするGSI
  global_secondary_index {
    name               = "OwnerIdIndex"
    hash_key           = "owner_id"
    projection_type    = "ALL"
  }
}

# 8. GroupMembers テーブル
resource "aws_dynamodb_table" "group_members" {
  name         = "streeeak-group-members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "group_id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name               = "GroupIdIndex"
    hash_key           = "group_id"
    projection_type    = "ALL"
  }
  global_secondary_index {
    name               = "UserIdIndex"
    hash_key           = "user_id"
    projection_type    = "ALL"
  }
}

# 9. Posts テーブル
resource "aws_dynamodb_table" "posts" {
  name         = "streeeak-posts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "group_id"
    type = "S"
  }

  global_secondary_index {
    name               = "UserIdIndex"
    hash_key           = "user_id"
    projection_type    = "ALL"
  }
  
  # 特定のグループ内の投稿を一覧取得するためのGSI（group_idが設定されているデータのみ自動でインデックスされます = スパースインデックス）
  global_secondary_index {
    name               = "GroupIdIndex"
    hash_key           = "group_id"
    projection_type    = "ALL"
  }
}

# 10. PostLikes テーブル
resource "aws_dynamodb_table" "post_likes" {
  name         = "streeeak-post-likes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "post_id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name               = "PostIdIndex"
    hash_key           = "post_id"
    projection_type    = "ALL"
  }
  global_secondary_index {
    name               = "UserIdIndex"
    hash_key           = "user_id"
    projection_type    = "ALL"
  }
}

# 11. Meta table for atomic ID sequences
resource "aws_dynamodb_table" "meta" {
  name         = "streeeak-meta"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "entity"

  attribute {
    name = "entity"
    type = "S"
  }
}


# # S3 Buckets

# # 静的コンテンツ用S3バケット
# resource "aws_s3_bucket" "static_content" {
#   bucket = "streeeak-frontend-111"
# }


# # RDS (Database)

# # DB用セキュリティグループ
# resource "aws_security_group" "db_sg" {
#   name        = "streeeak-rds-sg"
#   description = "Security group for Streeeak RDS"
#   vpc_id      = aws_vpc.main.id

#   # インバウンドルール (Webサーバーからのアクセスを許可)
#   ingress {
#     from_port       = 5432
#     to_port         = 5432
#     protocol        = "tcp"
#     security_groups = [aws_security_group.web_sg.id]
#   }

#   egress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = "-1"
#     cidr_blocks = ["0.0.0.0/0"]
#   }
# }

# # DBサブネットグループ (マルチAZ配置用)
# resource "aws_db_subnet_group" "main" {
#   name        = "streeeak-db-subnet-group"
#   description = "streeeak-db-subnet-group"
#   subnet_ids = [
#     aws_subnet.public_1a.id,
#     aws_subnet.public_1c.id,
#     aws_subnet.private_1a.id,
#     aws_subnet.public_1d.id
#   ]
# }

# # 5. RDSインスタンス (マルチAZ)
# resource "aws_db_instance" "main" {
#   identifier                   = "streeeak-db"
#   engine                       = "postgres"
#   engine_version               = "17.6"
#   instance_class               = "db.t3.micro"
#   storage_encrypted            = true
#   max_allocated_storage        = 1000
#   copy_tags_to_snapshot        = true
#   performance_insights_enabled = true
#   allocated_storage            = 20
#   db_subnet_group_name         = aws_db_subnet_group.main.name
#   vpc_security_group_ids       = [aws_security_group.db_sg.id]
#   multi_az                     = true
#   skip_final_snapshot          = true
# }
