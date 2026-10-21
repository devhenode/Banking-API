import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Partitioners, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaService.name);
    private readonly kafka: Kafka;
    private producer: Producer;
    private isConnected = false;

    constructor(private readonly config: ConfigService) {
        const brokers = this.config.get<string>('KAFKA_BROKERS', 'localhost:9094').split(',');
        this.kafka = new Kafka({
            clientId: 'banking-api',
            brokers,
            retry: {
                initialRetryTime: 300,
                retries: 5,
            },
        });

        this.producer = this.kafka.producer({
            createPartitioner: Partitioners.DefaultPartitioner,
        });
    }

    async onModuleInit() {
        try {
            await this.producer.connect();
            this.isConnected = true;
            this.logger.log('Connected to Apache Kafka broker cluster successfully.');
        } catch (error) {
            this.logger.warn(
                `Deferred Kafka connection (broker not ready or offline): ${(error as Error).message}`,
            );
        }
    }

    async onModuleDestroy() {
        if (this.isConnected) {
            await this.producer.disconnect();
            this.logger.log('Disconnected from Apache Kafka broker.');
        }
    }

    async send(topic: string, key: string, payload: any, headers?: Record<string, string>) {
        if (!this.isConnected) {
            await this.producer.connect();
            this.isConnected = true;
        }

        return this.producer.send({
            topic,
            messages: [
                {
                    key,
                    value: typeof payload === 'string' ? payload : JSON.stringify(payload),
                    headers,
                },
            ],
        });
    }

    getClient(): Kafka {
        return this.kafka;
    }
}
