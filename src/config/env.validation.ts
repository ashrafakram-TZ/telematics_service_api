import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const VEHICLE_TOPIC = /^([^+#/]+\/)*\+(\/[^+#/]+)*$/;

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsOptional()
  @IsString()
  HOST?: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsTimeZone()
  APP_TIMEZONE: string = 'Asia/Kolkata';

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsString()
  @IsNotEmpty({ message: 'API_KEYS must list at least one key (comma separated, 32+ characters each)' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.split(',').every((key) => key.trim().length >= 32) ? value : '',
  )
  API_KEYS: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  ONLINE_WINDOW_SECONDS: number = 120;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  DB_SSL?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  MQTT_ENABLED?: boolean;

  @IsOptional()
  @IsString()
  MQTT_URL?: string;

  @IsOptional()
  @IsString()
  MQTT_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  MQTT_TOPIC_FILTER?: string;

  @IsOptional()
  @Matches(VEHICLE_TOPIC, { message: 'MQTT_GPS_TOPIC must have exactly one + segment for the vehicle IMEI' })
  MQTT_GPS_TOPIC?: string;

  @IsOptional()
  @Matches(VEHICLE_TOPIC, { message: 'MQTT_OBD_TOPIC must have exactly one + segment for the vehicle IMEI' })
  MQTT_OBD_TOPIC?: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: false });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(`Invalid environment:\n- ${messages.join('\n- ')}`);
  }
  if (validated.MQTT_ENABLED && !validated.MQTT_URL)
    throw new Error('Invalid environment:\n- MQTT_URL is required when MQTT_ENABLED=true');
  return validated;
}
