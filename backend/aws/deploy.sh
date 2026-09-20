#!/usr/bin/env bash
set -e

# ==============================================================================
# UPIwise - AWS API Gateway + Lambda + DynamoDB Deployment Script
# ==============================================================================

REGION="${AWS_REGION:-ap-south-1}"
TABLE_NAME="${DYNAMODB_TABLE_NAME:-upi-costguard-calculations}"
FUNCTION_NAME="upi-costguard-api-handler"
API_NAME="upi-costguard-api"
ROLE_NAME="upi-costguard-lambda-role"

echo "============================================================"
echo " UPIwise Serverless Deployment to AWS ($REGION)"
echo "============================================================"

# 1. Check dependencies
command -v aws >/dev/null 2>&1 || { echo >&2 "Error: AWS CLI is not installed or not in PATH."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "Error: npm is not installed."; exit 1; }

# 2. Run local verification tests
echo "Step 1: Running automated tests locally..."
npm test

# 3. Build single-file production bundle for Lambda
echo "Step 2: Building Lambda bundle with esbuild..."
npm run build:lambda

# Check if AWS SAM is available
if command -v sam >/dev/null 2>&1; then
  echo "Step 3: Deploying via AWS SAM (Serverless Application Model)..."
  sam deploy \
    --template-file backend/aws/template.yaml \
    --stack-name upiwise-backend \
    --capabilities CAPABILITY_IAM \
    --region "$REGION" \
    --resolve-s3 \
    --no-fail-on-empty-changeset
  
  API_URL=$(aws cloudformation describe-stacks \
    --stack-name upiwise-backend \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
    --output text)

  echo "============================================================"
  echo " Deployment Succeeded via SAM!"
  echo " API Base URL: $API_URL"
  echo " Set in frontend .env:"
  echo "   VITE_API_BASE_URL=$API_URL"
  echo "============================================================"
  exit 0
fi

# Fallback: Direct AWS CLI Deployment
echo "Step 3: Deploying using standard AWS CLI..."

# 3a. Ensure DynamoDB table exists
echo "  Checking DynamoDB table: $TABLE_NAME..."
if ! aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "  Creating DynamoDB table $TABLE_NAME..."
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions AttributeName=calculationId,AttributeType=S \
    --key-schema AttributeName=calculationId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "  Waiting for table to become ACTIVE..."
  aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
fi

# 3b. Create or verify IAM role
echo "  Ensuring IAM Role: $ROLE_NAME..."
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query "Role.Arn" --output text 2>/dev/null || true)
if [ -z "$ROLE_ARN" ]; then
  echo "  Creating IAM Role $ROLE_NAME..."
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --query "Role.Arn" \
    --output text)
  
  echo "  Attaching policies..."
  aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "DynamoDBAndLogsAccess" \
    --policy-document file://backend/aws/iam-policy.json
  
  echo "  Sleeping 10s for IAM propagation..."
  sleep 10
fi

# 3c. Package zip
echo "  Packaging Lambda zip..."
mkdir -p dist-lambda
(cd dist-lambda && zip -q -r function.zip index.js)

# 3d. Create or update Lambda function
echo "  Deploying Lambda function: $FUNCTION_NAME..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://dist-lambda/function.zip \
    --region "$REGION" >/dev/null
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={DYNAMODB_TABLE_NAME=$TABLE_NAME,CORS_ALLOW_ORIGIN=*,NODE_ENV=production}" \
    --region "$REGION" >/dev/null
else
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://dist-lambda/function.zip \
    --timeout 10 \
    --memory-size 256 \
    --environment "Variables={DYNAMODB_TABLE_NAME=$TABLE_NAME,CORS_ALLOW_ORIGIN=*,NODE_ENV=production}" \
    --region "$REGION" >/dev/null
fi

LAMBDA_ARN=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query "Configuration.FunctionArn" --output text)

# 3e. Create or update HTTP API Gateway
echo "  Configuring API Gateway HTTP API..."
API_ID=$(aws apigatewayv2 get-apis --region "$REGION" --query "Items[?Name=='$API_NAME'].ApiId" --output text)
if [ -z "$API_ID" ]; then
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,OPTIONS,AllowHeaders=Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Requested-With,MaxAge=86400" \
    --target "$LAMBDA_ARN" \
    --region "$REGION" \
    --query "ApiId" \
    --output text)

  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "apigateway-access" \
    --action "lambda:InvokeFunction" \
    --principal "apigateway.amazonaws.com" \
    --source-arn "arn:aws:execute-api:$REGION:*:$API_ID/*" \
    --region "$REGION" >/dev/null 2>&1 || true
fi

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"

echo "============================================================"
echo " Deployment Complete!"
echo " API Endpoint: $API_URL"
echo " Endpoints:"
echo "   POST $API_URL/analyze"
echo "   GET  $API_URL/history"
echo "   GET  $API_URL/health"
echo " Set frontend .env:"
echo "   VITE_API_BASE_URL=$API_URL"
echo "============================================================"
