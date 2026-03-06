
# 1. ALB
resource "aws_lb" "main" {
  name               = "streeeak-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.web_sg.id, "sg-0a3cf7e6472e0d1d7"]
  subnets            = [aws_subnet.public_1a.id, aws_subnet.public_1c.id, aws_subnet.public_1d.id]
}

# 2. ターゲットグループ
resource "aws_lb_target_group" "main" {
  name                 = "streeeak-tg"
  port                 = 8000
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30
}

# 3. ALBリスナー (HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = "arn:aws:acm:ap-northeast-1:382715181910:certificate/2c45a8c3-0b8c-42af-a7ce-3a393f19ae6c"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
}

# 4. EC2インスタンス
resource "aws_instance" "app_1" {
  ami                    = "ami-088103e734f7e0529"
  instance_type          = "t2.micro"
  subnet_id              = aws_subnet.public_1a.id
  vpc_security_group_ids = [aws_security_group.web_sg.id]

  tags = {
    Name = "streeeak-api"
  }
}

# 5. ターゲットグループへの登録
resource "aws_lb_target_group_attachment" "app_1" {
  target_group_arn = aws_lb_target_group.main.arn
  target_id        = aws_instance.app_1.id
  port             = 8000
}
resource "aws_ecr_repository" "backend" {
  name                 = "streeeak-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}