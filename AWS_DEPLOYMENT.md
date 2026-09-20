# AWS Deployment Guide for UPIwise

This guide documents the serverless backend architecture connecting **UPIwise** to **AWS API Gateway**, **AWS Lambda**, and **AWS DynamoDB**.

---

## 1. Architecture Overview

```
                      +-----------------------------+
                      |   UPIwise Frontend (React)  |
                      +--------------+--------------+
                                     |
                          HTTPS / CORS Requests
                                     |
                                     v
                      +-----------------------------+
                      |    AWS API Gateway (v2)     |
                      |      upi-costguard-api      |
                      +--------------+--------------+
                                     |
                               Proxy Event
                                     |
                                     v
                      +-----------------------------+
                      |     AWS Lambda Function     |
                      |  upi-costguard-api-handler  |
                      |      (Node.js 20.x arm64)   |
                      |                             |
                      |  - Input Validation         |
                      |  - Deterministic MDR Engine |
                      |  - DynamoDB Data Access     |
                      +--------------+--------------+
                                     |
                           AWS SDK v3 Put / Scan
                                     |
                                     v
                      +-----------------------------+
                      |        AWS DynamoDB         |
                      | upi-costguard-calculations  |
                      |   Partition: calculationId  |
                      +-----------------------------+
```

### Key Design Decisions
1. **Single Unified Lambda Function**: Rather than deploying multiple cold-start-heavy functions, a single unified Lambda handler dispatches requests to `/analyze` and `/history`. This minimizes latency, cold starts, and AWS costs.
2. **Deterministic Rules Engine**: The MDR calculation logic runs entirely within the Lambda runtime without external third-party API dependencies or non-deterministic LLMs.
3. **Strict Zero-Surcharge Compliance**: Automatically verifies and stores `customerCharge: 0.00` per RBI / NPCI regulations.
4. **CORS Built-In**: Comprehensive CORS preflight (`OPTIONS`) and header injection across all endpoints.

---

## 2. DynamoDB Specification

* **Table Name**: `upi-costguard-calculations`
* **Partition Key**: `calculationId` (String, UUID v4)
* **Billing Mode**: Pay-per-request (`PAY_PER_REQUEST` / On-Demand)
* **Encryption**: Server-Side Encryption (AWS KMS / Default)
* **Point-in-time Recovery**: Enabled

### Stored Item Attributes

| Attribute | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `calculationId` | String | Unique transaction ID (Partition Key) | `"e7c10b54-9382-411a-8f19-3d07ecb27a3c"` |
| `timestamp` | String | ISO 8601 creation timestamp | `"2026-10-01T14:32:00.000Z"` |
| `amount` | Number | Transaction amount in INR | `10000` |
| `transactionType` | String | Transaction type (`P2P` or `P2M`) | `"P2M"` |
| `merchantCategory` | String | Industry category (`general`, `essential`, `capital_market`) | `"general"` |
| `eligibleSmallMerchant` | Boolean | Whether small merchant exemption applies | `false` |
| `mdrApplicable` | Boolean | Whether MDR fee is greater than ₹0 | `true` |
| `calculatedMdr` | Number | Final MDR fee in INR | `40` |
| `customerCharge` | Number | Customer convenience fee (strictly 0.00) | `0` |
| `merchantImpact` | String | Plain-language settlement deduction statement | `"An MDR fee of ₹40.00 (0.40%) is deducted..."` |
| `ruleCode` | String | Official regulatory rule identifier | `"RULE_P2M_STANDARD"` |

---

## 3. API Routes Specification

### `POST /analyze`
Analyzes a UPI transaction against October 2026 MDR rules and saves the calculation to DynamoDB.

**Request Headers**:
```http
Content-Type: application/json
```

**Request Body**:
```json
{
  "amount": 25000,
  "transactionType": "P2M",
  "merchantCategory": "general",
  "eligibleSmallMerchant": false
}
```

**Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "calculationId": "4a737f19-3a3f-42ae-9bc7-54261da4b189",
    "timestamp": "2026-10-01T10:15:30.123Z",
    "amount": 25000,
    "transactionType": "P2M",
    "merchantCategory": "general",
    "eligibleSmallMerchant": false,
    "mdrApplicable": true,
    "calculatedMdr": 100,
    "customerCharge": 0,
    "merchantImpact": "An MDR fee of ₹100.00 (0.40%) is deducted from the merchant payout. Merchant receives ₹24,900.00.",
    "ruleCode": "RULE_P2M_STANDARD",
    "rate": 0.004,
    "fixedCharge": 0,
    "capApplied": false,
    "netMerchantPayout": 24900
  },
  "id": "4a737f19-3a3f-42ae-9bc7-54261da4b189",
  "mdrRate": 0.004,
  "mdrRatePercent": "0.40%",
  "estimatedFee": 100,
  "ruleApplied": "RULE_P2M_STANDARD: Standard commercial P2M transactions exceeding ₹2,000 are subject to a 0.40% MDR rate...",
  "exemptionReason": null,
  "savedToDB": true
}
```

---

### `GET /history`
Retrieves recent calculation records from DynamoDB ordered by timestamp descending.

**Query Parameters**:
* `limit` *(optional)*: Number of records to return (default: `20`, max: `100`).

**Response (`200 OK`)**:
```json
{
  "items": [
    {
      "calculationId": "4a737f19-3a3f-42ae-9bc7-54261da4b189",
      "timestamp": "2026-10-01T10:15:30.123Z",
      "amount": 25000,
      "transactionType": "P2M",
      "merchantCategory": "general",
      "eligibleSmallMerchant": false,
      "mdrApplicable": true,
      "calculatedMdr": 100,
      "customerCharge": 0,
      "merchantImpact": "An MDR fee of ₹100.00 (0.40%) is deducted from the merchant payout. Merchant receives ₹24,900.00.",
      "ruleCode": "RULE_P2M_STANDARD"
    }
  ],
  "count": 1
}
```

---

## 4. Environment Variables Configuration

| Variable Name | Required | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `DYNAMODB_TABLE_NAME` | Yes | `upi-costguard-calculations` | Target DynamoDB table name |
| `AWS_REGION` | Yes | `ap-south-1` | AWS region hosting DynamoDB & Lambda |
| `CORS_ALLOW_ORIGIN` | No | `*` | Allowed CORS origin (e.g. `https://yourdomain.com` or `*`) |
| `NODE_ENV` | No | `production` | Environment mode (`production` or `development`) |
| `USE_LOCAL_MOCK_DB` | No | `false` | When `true`, enables in-memory mock store for local dev |

---

## 5. IAM Permissions (Least-Privilege)

Attach the following policy to the Lambda Execution Role (`upi-costguard-lambda-role`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBCalculationsAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:DescribeTable"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/upi-costguard-calculations",
        "arn:aws:dynamodb:*:*:table/upi-costguard-calculations/*"
      ]
    },
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

---

## 6. Testing Locally Before Deployment

### 6.1 Run Automated Tests
Execute the comprehensive test suite validating all 22 tests (14 MDR boundary cases + 8 Lambda/DynamoDB integration cases):

```bash
npm test
```

### 6.2 Run Local API Gateway Emulator
Start the lightweight local emulator running on `http://localhost:3001`:

```bash
npm run dev:api
```

Test endpoints locally with curl:
```bash
# Health check
curl http://localhost:3001/health

# Analyze standard P2M payment
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "transactionType": "P2M", "merchantCategory": "general", "eligibleSmallMerchant": false}'

# Retrieve stored history
curl http://localhost:3001/history
```

---

## 7. Deployment Instructions

### Option A: 1-Command Deployment via AWS SAM (Recommended)

1. Ensure AWS CLI and SAM CLI are configured with valid credentials (`aws configure`).
2. Run the deployment command from the project root:

```bash
# Build the single-file Lambda bundle
npm run build:lambda

# Deploy stack via SAM
sam deploy \
  --template-file backend/aws/template.yaml \
  --stack-name upiwise-backend \
  --capabilities CAPABILITY_IAM \
  --region ap-south-1 \
  --resolve-s3
```

SAM will output your live API Gateway endpoint:
```
Outputs:
ApiEndpoint = https://abcdef1234.execute-api.ap-south-1.amazonaws.com
TableName   = upi-costguard-calculations
```

---

### Option B: Automated Script via AWS CLI

Run the included automated deployment script:

```bash
./backend/aws/deploy.sh
```

This script will automatically:
1. Run local verification tests (`npm test`).
2. Build the optimized Lambda bundle with esbuild (`dist-lambda/index.js`).
3. Create DynamoDB table `upi-costguard-calculations` with on-demand billing.
4. Create the IAM execution role with minimal DynamoDB and CloudWatch permissions.
5. Create or update the Lambda function `upi-costguard-api-handler`.
6. Create or update the HTTP API Gateway with CORS and proxy routing.
7. Print your ready-to-use API URL.

---

### Option C: Manual AWS Console Setup

If deploying manually via the AWS Web Console:

1. **DynamoDB**:
   - Go to **DynamoDB Console** -> **Create Table**.
   - Table Name: `upi-costguard-calculations`.
   - Partition Key: `calculationId` (String).
   - Table class: Standard, Capacity: On-Demand.
   - Click **Create Table**.

2. **IAM Role**:
   - Go to **IAM Console** -> **Roles** -> **Create Role**.
   - Trusted Entity: **AWS Service** -> **Lambda**.
   - Create and attach an inline policy using `backend/aws/iam-policy.json`.
   - Name the role `upi-costguard-lambda-role`.

3. **Lambda Function**:
   - Run `npm run build:lambda`.
   - Zip `dist-lambda/index.js` into `function.zip`.
   - Go to **Lambda Console** -> **Create Function**.
   - Function name: `upi-costguard-api-handler`.
   - Runtime: **Node.js 20.x**, Architecture: **arm64** or **x86_64**.
   - Execution role: Select `upi-costguard-lambda-role`.
   - Upload `function.zip`.
   - In **Configuration** -> **Environment variables**, set:
     - `DYNAMODB_TABLE_NAME` = `upi-costguard-calculations`
     - `CORS_ALLOW_ORIGIN` = `*`

4. **API Gateway**:
   - Go to **API Gateway Console** -> **Create API** -> **HTTP API**.
   - Add Integration: Select **Lambda**, choose `upi-costguard-api-handler`.
   - Configure CORS: Origins `*`, Methods `GET, POST, OPTIONS`.
   - Deploy stage: `$default`.

---

## 8. Connecting Frontend to AWS

Once deployed, set the API Gateway URL in your frontend environment:

Create or edit `.env`:
```env
VITE_API_BASE_URL=https://<your-api-id>.execute-api.ap-south-1.amazonaws.com
```

Then start or build the frontend:
```bash
npm run dev
```

The frontend will automatically route requests to `POST /analyze` and `GET /history` on your live AWS serverless backend!
