# Stateファイル保存用のS3バケット
resource "aws_s3_bucket" "terraform_state" {
  bucket = "streeeak-terraform-state-storage" # 世界で唯一の名前に変更してください
}

# バケットのバージョニングを有効化
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 排他制御用のDynamoDBテーブル
resource "aws_dynamodb_table" "terraform_lock" {
  name         = "streeeak-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}