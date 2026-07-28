#!/usr/bin/env python3
"""Topic + service taxonomy for SAA-C03 questions."""
import re

# ── topics ─────────────────────────────────────────────────────────────────
# id, spanish label, short blurb shown on the topic card
TOPICS = [
    ("s3",         "S3 y almacenamiento de objetos",
     "Clases de almacenamiento, lifecycle, versionado, Object Lock, replicación, cifrado y acceso."),
    ("storage",    "Almacenamiento de bloques y archivos",
     "EBS, EFS, FSx, Storage Gateway: tipos de volumen, IOPS, rendimiento y acceso compartido."),
    ("compute",    "Cómputo y contenedores",
     "EC2, Auto Scaling, Spot/Reserved, Lambda, ECS/EKS/Fargate, Batch y Elastic Beanstalk."),
    ("network",    "Redes y entrega de contenido",
     "VPC, subredes, NAT, endpoints, peering, Transit Gateway, ELB, Route 53, CloudFront."),
    ("database",   "Bases de datos",
     "RDS, Aurora, DynamoDB, ElastiCache, Redshift y bases de datos especializadas."),
    ("security",   "Seguridad, identidad y cumplimiento",
     "IAM, KMS, Secrets Manager, WAF, Shield, GuardDuty, Cognito, Macie e Inspector."),
    ("integration", "Integración de aplicaciones",
     "SQS, SNS, EventBridge, Step Functions, API Gateway y patrones de desacoplamiento."),
    ("analytics",  "Analítica y streaming",
     "Kinesis, Athena, Glue, EMR, QuickSight, OpenSearch y lagos de datos."),
    ("management", "Gestión, monitoreo y gobernanza",
     "CloudWatch, CloudTrail, Config, Systems Manager, Organizations y Control Tower."),
    ("migration",  "Migración y transferencia de datos",
     "DataSync, Snow Family, DMS, Transfer Family y estrategias híbridas."),
    ("deployment", "Despliegue e infraestructura como código",
     "CloudFormation, CDK, Elastic Beanstalk, OpsWorks y servicios de CI/CD."),
    ("ai",         "IA y servicios especializados",
     "Rekognition, Comprehend, Textract, Transcribe, SageMaker y otros servicios gestionados."),
    ("cost",       "Costos y facturación",
     "Cost Explorer, Budgets, Savings Plans, Reserved Instances e informes de uso."),
]
TOPIC_IDS = [t[0] for t in TOPICS]

# ── services: canonical name, regex, topic ────────────────────────────────
def _s(name, pattern, topic):
    return (name, re.compile(pattern, re.I), topic)


SERVICES = [
    # S3 / object storage
    _s("Amazon S3", r"\bamazon s3\b|\bs3 bucket|\bs3\b(?!\s*(file gateway|glacier))", "s3"),
    _s("S3 Glacier", r"glacier", "s3"),
    _s("S3 Intelligent-Tiering", r"intelligent[- ]tiering", "s3"),
    _s("S3 Object Lock", r"object lock", "s3"),
    _s("S3 Lifecycle", r"lifecycle (policy|policies|configuration|rule)", "s3"),
    _s("S3 Transfer Acceleration", r"transfer acceleration", "s3"),
    _s("S3 Replication", r"cross-region replication|\bCRR\b|same-region replication|s3 replication", "s3"),
    _s("S3 Versioning", r"\bversioning\b", "s3"),
    # block / file storage
    _s("Amazon EBS", r"\bEBS\b|elastic block store", "storage"),
    _s("Amazon EFS", r"\bEFS\b|elastic file system", "storage"),
    _s("Amazon FSx", r"\bFSx\b", "storage"),
    _s("Storage Gateway", r"storage gateway|file gateway|volume gateway|tape gateway", "storage"),
    _s("Instance Store", r"instance store", "storage"),
    _s("AWS Backup", r"aws backup", "storage"),
    # compute
    _s("Amazon EC2", r"\bEC2\b|elastic compute cloud", "compute"),
    _s("Auto Scaling", r"auto scaling|autoscaling", "compute"),
    _s("Spot Instances", r"spot instance|spot fleet", "compute"),
    _s("Reserved Instances", r"reserved instance", "cost"),
    _s("Savings Plans", r"savings plan", "cost"),
    _s("AWS Lambda", r"\blambda\b", "compute"),
    _s("Amazon ECS", r"\bECS\b|elastic container service", "compute"),
    _s("Amazon EKS", r"\bEKS\b|elastic kubernetes", "compute"),
    _s("AWS Fargate", r"fargate", "compute"),
    _s("AWS Batch", r"aws batch", "compute"),
    _s("Elastic Beanstalk", r"beanstalk", "deployment"),
    _s("Amazon Lightsail", r"lightsail", "compute"),
    _s("AWS Outposts", r"outposts", "compute"),
    _s("Local Zones", r"local zones?", "compute"),
    _s("Wavelength", r"wavelength", "compute"),
    _s("Placement Groups", r"placement group", "compute"),
    _s("AWS App Runner", r"app runner", "compute"),
    # networking
    _s("Amazon VPC", r"\bVPC\b", "network"),
    _s("NAT Gateway", r"nat gateway|nat instance", "network"),
    _s("Internet Gateway", r"internet gateway", "network"),
    _s("Security Groups", r"security group", "network"),
    _s("Network ACL", r"network acl|\bNACL\b", "network"),
    _s("VPC Endpoints", r"vpc endpoint|interface endpoint|gateway endpoint|privatelink", "network"),
    _s("VPC Peering", r"peering", "network"),
    _s("Transit Gateway", r"transit gateway", "network"),
    _s("Direct Connect", r"direct connect", "network"),
    _s("Site-to-Site VPN", r"site-to-site vpn|\bVPN\b", "network"),
    _s("Elastic Load Balancing", r"load balancer|\bELB\b|\bALB\b|\bNLB\b", "network"),
    _s("Amazon Route 53", r"route\s*53", "network"),
    _s("Amazon CloudFront", r"cloudfront", "network"),
    _s("Global Accelerator", r"global accelerator", "network"),
    _s("VPC Flow Logs", r"flow logs?", "network"),
    # databases
    _s("Amazon RDS", r"\bRDS\b|relational database service", "database"),
    _s("Amazon Aurora", r"aurora", "database"),
    _s("Amazon DynamoDB", r"dynamodb", "database"),
    _s("Amazon ElastiCache", r"elasticache|memcached|\bredis\b", "database"),
    _s("Amazon Redshift", r"redshift", "analytics"),
    _s("Amazon DocumentDB", r"documentdb", "database"),
    _s("Amazon Neptune", r"neptune", "database"),
    _s("Amazon Timestream", r"timestream", "database"),
    _s("Amazon Keyspaces", r"keyspaces", "database"),
    _s("Amazon MemoryDB", r"memorydb", "database"),
    _s("Read Replicas", r"read replica", "database"),
    _s("Multi-AZ", r"multi-az", "database"),
    # security
    _s("AWS IAM", r"\bIAM\b|identity and access management", "security"),
    _s("AWS STS", r"\bSTS\b|assumerole|assume role", "security"),
    _s("AWS KMS", r"\bKMS\b|key management service", "security"),
    _s("CloudHSM", r"cloudhsm", "security"),
    _s("Secrets Manager", r"secrets manager", "security"),
    _s("Parameter Store", r"parameter store", "security"),
    _s("AWS Certificate Manager", r"certificate manager|\bACM\b", "security"),
    _s("AWS WAF", r"\bWAF\b", "security"),
    _s("AWS Shield", r"\bshield\b", "security"),
    _s("Amazon GuardDuty", r"guardduty", "security"),
    _s("Amazon Inspector", r"amazon inspector", "security"),
    _s("Amazon Macie", r"macie", "security"),
    _s("Amazon Cognito", r"cognito", "security"),
    _s("AWS Directory Service", r"directory service|active directory", "security"),
    _s("Network Firewall", r"network firewall", "security"),
    _s("Firewall Manager", r"firewall manager", "security"),
    _s("Security Hub", r"security hub", "security"),
    _s("AWS Detective", r"aws detective", "security"),
    _s("SCPs", r"service control polic", "security"),
    # integration
    _s("Amazon SQS", r"\bSQS\b|simple queue service", "integration"),
    _s("Amazon SNS", r"\bSNS\b|simple notification service", "integration"),
    _s("Amazon EventBridge", r"eventbridge|cloudwatch events", "integration"),
    _s("AWS Step Functions", r"step functions", "integration"),
    _s("Amazon API Gateway", r"api gateway", "integration"),
    _s("AWS AppSync", r"appsync", "integration"),
    _s("Amazon MQ", r"amazon mq", "integration"),
    _s("Amazon AppFlow", r"appflow", "integration"),
    _s("Amazon SES", r"\bSES\b|simple email service", "integration"),
    # analytics
    _s("Amazon Kinesis", r"kinesis", "analytics"),
    _s("Amazon Athena", r"athena", "analytics"),
    _s("AWS Glue", r"\bglue\b", "analytics"),
    _s("Amazon EMR", r"\bEMR\b|elastic mapreduce", "analytics"),
    _s("Amazon QuickSight", r"quicksight", "analytics"),
    _s("Amazon OpenSearch", r"opensearch|elasticsearch", "analytics"),
    _s("Lake Formation", r"lake formation", "analytics"),
    _s("Amazon MSK", r"\bMSK\b|managed streaming for apache kafka|\bkafka\b", "analytics"),
    _s("Data Pipeline", r"data pipeline", "analytics"),
    # management
    _s("Amazon CloudWatch", r"cloudwatch", "management"),
    _s("AWS CloudTrail", r"cloudtrail", "management"),
    _s("AWS Config", r"aws config\b", "management"),
    _s("Systems Manager", r"systems manager|\bSSM\b|session manager|patch manager|run command", "management"),
    _s("AWS Organizations", r"organizations\b|organizational unit", "management"),
    _s("AWS Control Tower", r"control tower", "management"),
    _s("Trusted Advisor", r"trusted advisor", "management"),
    _s("Service Catalog", r"service catalog", "management"),
    _s("AWS X-Ray", r"x-ray", "management"),
    _s("Compute Optimizer", r"compute optimizer", "cost"),
    _s("AWS Health", r"health dashboard", "management"),
    _s("Resource Access Manager", r"resource access manager|\bRAM\b", "management"),
    # migration
    _s("AWS DataSync", r"datasync", "migration"),
    _s("Snow Family", r"snowball|snowmobile|snowcone|snow family", "migration"),
    _s("AWS DMS", r"\bDMS\b|database migration service", "migration"),
    _s("Transfer Family", r"transfer family|\bsftp\b|aws transfer", "migration"),
    _s("Migration Hub", r"migration hub", "migration"),
    _s("Application Discovery", r"application discovery", "migration"),
    _s("Server Migration Service", r"server migration service", "migration"),
    # deployment
    _s("AWS CloudFormation", r"cloudformation", "deployment"),
    _s("AWS CDK", r"\bCDK\b|cloud development kit", "deployment"),
    _s("AWS OpsWorks", r"opsworks", "deployment"),
    _s("CodeDeploy", r"codedeploy|codepipeline|codebuild|codecommit", "deployment"),
    _s("AWS Amplify", r"amplify", "deployment"),
    _s("AWS Proton", r"aws proton", "deployment"),
    # AI / ML
    _s("Amazon Rekognition", r"rekognition", "ai"),
    _s("Amazon Comprehend", r"comprehend", "ai"),
    _s("Amazon Textract", r"textract", "ai"),
    _s("Amazon Transcribe", r"transcribe", "ai"),
    _s("Amazon Polly", r"polly", "ai"),
    _s("Amazon Translate", r"amazon translate", "ai"),
    _s("Amazon SageMaker", r"sagemaker", "ai"),
    _s("Amazon Fraud Detector", r"fraud detector", "ai"),
    _s("Amazon Forecast", r"amazon forecast", "ai"),
    _s("Amazon Kendra", r"kendra", "ai"),
    _s("Amazon Connect", r"amazon connect", "ai"),
    _s("Amazon WorkSpaces", r"workspaces|appstream", "compute"),
    _s("Amazon Pinpoint", r"pinpoint", "integration"),
    # cost
    _s("Cost Explorer", r"cost explorer", "cost"),
    _s("AWS Budgets", r"aws budgets|budget alert", "cost"),
    _s("Cost and Usage Report", r"cost and usage report|\bCUR\b", "cost"),
    _s("Billing", r"consolidated billing|billing alarm", "cost"),
]

# ── exam domains ──────────────────────────────────────────────────────────
DOMAINS = [
    ("secure", "Arquitecturas seguras",
     re.compile(r"secure|security|encrypt|least privilege|complian|unauthoriz|"
                r"credential|permission|confidential|audit|private(ly)? access|"
                r"public access|malicious|attack|ddos|vulnerab", re.I)),
    ("resilient", "Arquitecturas resilientes",
     re.compile(r"highly available|high availability|resilien|fault[- ]toleran|"
                r"disaster recovery|\bRTO\b|\bRPO\b|failover|durab|backup|"
                r"outage|availability zones?|redundan|decoupl", re.I)),
    ("performance", "Arquitecturas de alto rendimiento",
     re.compile(r"performan|latenc|throughput|scal(e|es|ing|able|ability)|"
                r"\bIOPS\b|bottleneck|response time|speed|faster|real[- ]time|"
                r"concurren", re.I)),
    ("cost", "Arquitecturas optimizadas en costo",
     re.compile(r"cost[- ]effective|cost[- ]optimi|least expensive|lowest cost|"
                r"reduce (the )?cost|minimize (the )?cost|cheapest|budget|"
                r"most cost", re.I)),
]

TOPIC_DOMAIN_FALLBACK = {
    "security": "secure", "network": "performance", "database": "performance",
    "compute": "performance", "s3": "cost", "storage": "performance",
    "integration": "resilient", "analytics": "performance",
    "management": "secure", "migration": "resilient", "deployment": "resilient",
    "ai": "performance", "cost": "cost",
}


def classify(stem: str, correct_texts, other_texts):
    """Return (topic, services, domain)."""
    scores = {t: 0.0 for t in TOPIC_IDS}
    found, order = {}, []

    def scan(text, weight, record):
        for name, rx, topic in SERVICES:
            if rx.search(text):
                scores[topic] += weight
                if record and name not in found:
                    found[name] = topic
                    order.append(name)

    scan(stem, 1.5, True)
    for t in correct_texts:
        scan(t, 3.0, True)
    for t in other_texts:
        scan(t, 0.35, False)

    topic = max(scores, key=lambda k: (scores[k], -TOPIC_IDS.index(k)))
    if scores[topic] == 0:
        topic = "compute"

    dscore = {}
    for d, _, rx in DOMAINS:
        dscore[d] = 2 * len(rx.findall(stem)) + sum(len(rx.findall(t)) for t in correct_texts)
    best = max(dscore.values())
    domain = (max(dscore, key=lambda k: dscore[k]) if best
              else TOPIC_DOMAIN_FALLBACK.get(topic, "resilient"))
    return topic, order[:6], domain


# ── option-level refinements ──────────────────────────────────────────────
# SERVICES is deliberately coarse: it feeds the topic chips, where "VPC
# Endpoints" is a useful bucket. But the confusions worth drilling live one
# level below it — a gateway endpoint and an interface endpoint are the same
# chip and opposite answers. These refinements apply ONLY to option labels, so
# the topic classification and the existing chips are untouched.
#   (refined name, regex, parent to replace or None)
def _r(name, pattern, parent=None):
    return (name, re.compile(pattern, re.I), parent)


OPTION_REFINEMENTS = [
    _r("Gateway endpoint", r"gateway endpoint", "VPC Endpoints"),
    _r("Interface endpoint (PrivateLink)", r"interface endpoint|privatelink", "VPC Endpoints"),
    _r("Application Load Balancer", r"application load balancer|\bALB\b", "Elastic Load Balancing"),
    _r("Network Load Balancer", r"network load balancer|\bNLB\b", "Elastic Load Balancing"),
    _r("Gateway Load Balancer", r"gateway load balancer|\bGWLB\b", "Elastic Load Balancing"),
    _r("FSx for Windows File Server", r"fsx for windows", "Amazon FSx"),
    _r("FSx for Lustre", r"fsx for lustre", "Amazon FSx"),
    _r("FSx for NetApp ONTAP", r"fsx for netapp|netapp ontap", "Amazon FSx"),
    _r("FSx for OpenZFS", r"fsx for openzfs|openzfs", "Amazon FSx"),
    _r("S3 Standard-IA", r"standard[- ]infrequent access|standard-ia", "Amazon S3"),
    _r("S3 One Zone-IA", r"one zone[- ]infrequent access|one zone-ia", "Amazon S3"),
    _r("S3 Glacier Deep Archive", r"deep archive", "S3 Glacier"),
    _r("S3 Glacier Instant Retrieval", r"glacier instant retrieval", "S3 Glacier"),
    _r("S3 Glacier Flexible Retrieval", r"glacier flexible retrieval", "S3 Glacier"),
    _r("Object Lock: compliance", r"compliance mode", "S3 Object Lock"),
    _r("Object Lock: governance", r"governance mode", "S3 Object Lock"),
    _r("Object Lock: legal hold", r"legal hold", "S3 Object Lock"),
    _r("File gateway", r"file gateway", "Storage Gateway"),
    _r("Volume gateway (cached)", r"cached volume", "Storage Gateway"),
    _r("Volume gateway (stored)", r"stored volume", "Storage Gateway"),
    _r("Tape gateway", r"tape gateway", "Storage Gateway"),
    _r("ECS on Fargate", r"(ecs|elastic container service)[^.]{0,60}fargate|"
                        r"fargate[^.]{0,60}(ecs|elastic container service)", "Amazon ECS"),
    _r("ECS on EC2", r"(ecs|elastic container service)[^.]{0,60}(ec2 launch type|ec2 worker)",
       "Amazon ECS"),
    _r("Spot Instances", r"spot instance|spot fleet|spot block", "Amazon EC2"),
    _r("Reserved Instances", r"reserved instance", "Amazon EC2"),
    _r("On-Demand Instances", r"on-demand instance", "Amazon EC2"),
    _r("Savings Plans", r"savings plan", "Amazon EC2"),
    _r("Cluster placement group", r"cluster placement group", "Placement Groups"),
    _r("Partition placement group", r"partition placement group", "Placement Groups"),
    _r("Spread placement group", r"spread placement group", "Placement Groups"),
    _r("SSE-KMS", r"\bSSE-KMS\b|kms keys? \(sse-kms\)", None),
    _r("SSE-S3", r"\bSSE-S3\b|s3 managed (encryption )?keys", None),
    _r("SSE-C", r"\bSSE-C\b|customer-provided keys", None),
    _r("Client-side encryption", r"client-side encryption", None),
    _r("DynamoDB on-demand mode", r"on-demand (capacity )?mode", "Amazon DynamoDB"),
    _r("DynamoDB provisioned mode", r"provisioned (capacity )?mode|provisioned capacity",
       "Amazon DynamoDB"),
    _r("DynamoDB PITR", r"point-in-time recovery", "Amazon DynamoDB"),
    _r("DynamoDB global tables", r"global table", "Amazon DynamoDB"),
    _r("Aurora global database", r"global database", "Amazon Aurora"),
    _r("Aurora Replica", r"aurora replica", "Amazon Aurora"),
    _r("RDS Proxy", r"rds proxy", "Amazon RDS"),
    _r("RDS Custom", r"rds custom", "Amazon RDS"),
    _r("SQS FIFO queue", r"fifo queue", "Amazon SQS"),
    _r("SQS standard queue", r"standard queue", "Amazon SQS"),
    _r("Kinesis Data Streams", r"kinesis data stream", "Amazon Kinesis"),
    _r("Kinesis Data Firehose", r"kinesis data firehose|firehose", "Amazon Kinesis"),
    _r("Kinesis Data Analytics", r"kinesis data analytics", "Amazon Kinesis"),
    _r("Shield Advanced", r"shield advanced", "AWS Shield"),
    _r("Shield Standard", r"shield standard", "AWS Shield"),
]


def services_in(text):
    """Every canonical service named in one piece of text, in SERVICES order.

    Used to label each answer option, which is what lets the app tell *which*
    two services a wrong pick confused — the stem-level service list cannot,
    because it does not say which option each name came from. Coarse buckets
    are replaced by their OPTION_REFINEMENTS variant when one matches.
    """
    found = [name for name, rx, _ in SERVICES if rx.search(text)]
    for name, rx, parent in OPTION_REFINEMENTS:
        if not rx.search(text):
            continue
        if parent and parent in found:
            found[found.index(parent)] = name
        elif name not in found:
            found.append(name)
    # A refinement can fire for two variants of the same parent (an option that
    # contrasts them); dedupe while keeping order.
    return list(dict.fromkeys(found))
