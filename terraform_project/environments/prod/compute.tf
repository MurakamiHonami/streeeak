resource "aws_ecr_repository" "backend" {
  name                 = "streeeak-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}
