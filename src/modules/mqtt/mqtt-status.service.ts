import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { mqttConfig, MqttConfig } from '../../config/mqtt.config';

export type MqttState = 'up' | 'down' | 'disabled';

@Injectable()
export class MqttStatusService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('MQTT');
  private client?: MqttClient;

  constructor(@Inject(mqttConfig.KEY) private readonly config: MqttConfig) {}

  onApplicationBootstrap(): void {
    if (!this.config.enabled) {
      this.logger.log('MQTT disabled');
      return;
    }

    this.client = connect(this.config.url, {
      clientId: `${this.config.clientId}-health`,
      username: this.config.username,
      password: this.config.password,
      reconnectPeriod: 5000,
    });
    this.client.on('connect', () => this.logger.log(`Connected to ${this.config.url}`));
    this.client.on('reconnect', () => this.logger.warn(`Reconnecting to ${this.config.url}`));
    this.client.on('offline', () => this.logger.warn('Broker offline'));
    this.client.on('error', (error) => this.logger.error(error.message));
  }

  status(): MqttState {
    if (!this.client) return 'disabled';
    return this.client.connected ? 'up' : 'down';
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client?.endAsync();
  }
}
