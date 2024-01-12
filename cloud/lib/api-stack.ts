import {
	ConnectionType,
	Cors,
	Integration,
	IntegrationType,
	MethodLoggingLevel,
	RestApi,
	VpcLink
} from 'aws-cdk-lib/aws-apigateway';
//import { UserPool, UserPoolClient, UserPoolDomain, } from 'aws-cdk-lib/aws-cognito';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { Cluster, ContainerImage, PropagatedTagSource, Secret as EnvSecret, } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { NetworkLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AlbTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { CfnOutput, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { join } from 'node:path';

import { resourceName, stageName } from './resourceNamingUtils';

type ApiStackProps = StackProps & {
	// userPool: UserPool;
	// userPoolClient: UserPoolClient;
	// userPoolDomain: UserPoolDomain;
	webappUrl: string;
};

export class ApiStack extends Stack {
	//public readonly loadBalancerUrl: string;

	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);
		// TODO Enable cognito auth on APIGateway? Or just rate-limit it?
		const { /*userPool, userPoolClient, userPoolDomain,*/ webappUrl } = props;

		const generateResourceName = resourceName(scope);

		const dockerImageAsset = new DockerImageAsset(
			this,
			generateResourceName('container-image'),
			{
				directory: join(__dirname, '../../backend/'),
			}
		);

		// Default AZs is all in region, but for environment-agnostic stack, max is 2!
		const vpcName = generateResourceName('vpc');
		const vpc = new Vpc(this, vpcName, {
			vpcName,
			restrictDefaultSecurityGroup: false, // TODO blog about this!
			maxAzs: 2,
		});
		const clusterName = generateResourceName('cluster');
		const cluster = new Cluster(this, clusterName, { clusterName, vpc });

		const apiKeySecret = Secret.fromSecretNameV2(
			this,
			generateResourceName('apiKey'),
			'dev/SpyLogic/ApiKey'
		);

		// Create a private, application-load-balanced Fargate service
		const containerPort = 3001;
		const healthCheckPath = '/health';
		const fargateServiceName = generateResourceName('fargate');
		const loadBalancerName = generateResourceName('alb');
		const loadBalancerLogName = generateResourceName('loadbalancer-logs');
		const fargateService = new ApplicationLoadBalancedFargateService(
			this,
			fargateServiceName,
			{
				serviceName: fargateServiceName,
				cluster,
				cpu: 256, // Default is 256
				desiredCount: 1, // Bump this up for prod!
				taskImageOptions: {
					image: ContainerImage.fromDockerImageAsset(dockerImageAsset),
					containerPort,
					environment: {
						NODE_ENV: 'production',
						PORT: `${containerPort}`,
						CORS_ALLOW_ORIGIN: webappUrl,
					},
					secrets: {
						OPENAI_API_KEY: EnvSecret.fromSecretsManager(
							apiKeySecret,
							'OPENAI_API_KEY'
						),
						SESSION_SECRET: EnvSecret.fromSecretsManager(
							apiKeySecret,
							'SESSION_SECRET'
						),
					},
				},
				memoryLimitMiB: 512, // Default is 512
				loadBalancerName,
				publicLoadBalancer: false,
				propagateTags: PropagatedTagSource.SERVICE,
			}
		);
		fargateService.targetGroup.configureHealthCheck({
			path: healthCheckPath,
		});
		fargateService.loadBalancer.logAccessLogs(
			new Bucket(this, loadBalancerLogName, {
				bucketName: loadBalancerLogName,
				autoDeleteObjects: true,
				removalPolicy: RemovalPolicy.DESTROY,
			})
		);

		// Hook up Cognito to load balancer
		// https://stackoverflow.com/q/71124324
		// TODO Needs HTTPS and a Route53 domain, so for now we're using APIGateway and VPCLink:
		// https://repost.aws/knowledge-center/api-gateway-alb-integration
		/*
		const authActionName = generateResourceName('alb-auth');
		fargateService.listener.addAction(authActionName, {
			action: new AuthenticateCognitoAction({
				userPool,
				userPoolClient,
				userPoolDomain,
				next: ListenerAction.forward([fargateService.targetGroup]),
			}),
		});
		*/
		//this.loadBalancerUrl = `https://${fargateService.loadBalancer.loadBalancerDnsName}`;

		// Create network loadbalancer targeting our application loadbalancer
		const nlbName = generateResourceName('nlb')
		const nlbSGName = generateResourceName('nlb-secgroup')
		const nlbListenerName = generateResourceName('nlb-listener');
		const nlbTargetName = generateResourceName('nlb-targets');
		const nlb = new NetworkLoadBalancer(this, nlbName, {
			loadBalancerName: nlbName,
			vpc,
			crossZoneEnabled: true,
			securityGroups: [
				new SecurityGroup(this, nlbSGName, {
					vpc,
					securityGroupName: nlbSGName,
				})
			],
		});
		const nlbListener = nlb.addListener(nlbListenerName, { port: 80 });
		nlbListener.addTargets(nlbTargetName, {
			targets: [new AlbTarget(fargateService.loadBalancer, 80)],
			port: 80,
			healthCheck: {
				path: healthCheckPath,
			},
		});

		// Create an HTTP APIGateway with a VPCLink integrated with our network load balancer
		const vpcLinkName = generateResourceName('vpclink');
		const vpcLink = new VpcLink(this, vpcLinkName, {
			vpcLinkName,
			targets: [nlb],
		});
		Object.entries(props.tags ?? {}).forEach(([key, value]) => {
			Tags.of(vpcLink).add(key, value);
		});

		const apiName = generateResourceName('api');
		const api = new RestApi(this, apiName, {
			restApiName: apiName,
			deployOptions: {
				stageName: stageName(scope),
				loggingLevel: MethodLoggingLevel.INFO,
				dataTraceEnabled: true, // TODO Turn off once tested
			},
		});
		api.root.addProxy({
			defaultIntegration: new Integration({
				type: IntegrationType.HTTP_PROXY,
				integrationHttpMethod: 'ANY',
				options: {
					connectionType: ConnectionType.VPC_LINK,
					vpcLink,
				},
			}),
		}).addCorsPreflight({
			allowOrigins: [webappUrl],
			allowMethods: Cors.ALL_METHODS,
			// TODO Might not need the cookie headers, if allowCredentials=true
			allowHeaders: ['X-Forwarded-For', 'X-Forwarded-Proto', 'Content-Type', 'Cookie'],
			exposeHeaders: ['Set-Cookie'],
			allowCredentials: true, // TODO Mention this in blog?
		});

		new CfnOutput(this, 'APIGatewayURL', { value: api.url });
	}
}
