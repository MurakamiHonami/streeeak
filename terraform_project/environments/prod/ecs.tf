# 1. ECS クラスター
resource "aws_ecs_cluster" "main" {
  name = "streeeak-prod-cluster"
}

# 2. タスク実行ロール 
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "streeeak-ecs-task-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# 3. タスク定義
resource "aws_ecs_task_definition" "backend" {
  family                   = "streeeak-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "streeeak-backend-container"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "APP_NAME", value = var.app_name },
        { name = "ENV", value = var.env_name },
        { name = "DATABASE_URL", value = var.database_url },
        { name = "SECRET_KEY", value = var.secret_key },
        { name = "ACCESS_TOKEN_EXPIRE_MINUTES", value = var.access_token_expire_minutes },
        { name = "GEMINI_API_KEY", value = var.gemini_api_key },
        { name = "GEMINI_MODEL", value = var.gemini_model },
        { name = "STRIPE_API_KEY", value = var.stripe_api_key },
        { name = "STRIPE_WEBHOOK_SECRET", value = var.stripe_webhook_secret },
        { name = "STRIPE_PRICE_ID", value = var.stripe_price_id },
        { name = "AWS_REGION", value = var.aws_region_name },
        { name = "COGNITO_CLIENT_ID", value = var.cognito_client_id },
        { name = "AWS_REGION", value = "ap-northeast-1" },
        { name = "ENVIRONMENT", value = "prod" }
      ]
    }
  ])
}

# 4. 新規ターゲットグループ(Fargate用)
resource "aws_lb_target_group" "ecs" {
  name        = "streeeak-ecs-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

# 5. ECS サービス
resource "aws_ecs_service" "backend" {
  name            = "streeeak-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1a.id]
    security_groups  = [aws_security_group.web_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs.arn
    container_name   = "streeeak-backend-container"
    container_port   = 8000
  }
  depends_on = [aws_lb_listener.http]
}
resource "aws_iam_role_policy_attachment" "ecs_cognito_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonCognitoPowerUser"
}