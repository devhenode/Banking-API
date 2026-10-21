import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service.js';
import { KafkaConsumerService } from './kafka-consumer.service.js';

@Module({
    providers: [KafkaService, KafkaConsumerService],
    exports: [KafkaService, KafkaConsumerService],
})
export class KafkaModule { }
