import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  // HTTP security headers — CSP ativo em produção, desabilitado apenas em dev (Swagger)
  app.use(helmet({
    contentSecurityPolicy: isProduction,
    crossOriginResourcePolicy: false, // necessário para servir avatars/anexos
  }));

  // CORS — requer FRONTEND_URL definido; sem fallback inseguro em produção
  const allowedOrigin = process.env.FRONTEND_URL;
  if (!allowedOrigin) {
    if (isProduction) {
      throw new Error('❌ FRONTEND_URL não definida. Configure antes de iniciar em produção.');
    }
    console.warn('⚠️  FRONTEND_URL não definida. Usando http://localhost:3000 (apenas desenvolvimento).');
  }

  app.enableCors({
    origin: allowedOrigin ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger — desabilitado em produção (reduz superfície de ataque)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('MY-FINANCE API')
      .setDescription('API de gestão financeira residencial')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`📚 Swagger em http://localhost:${process.env.PORT || 3001}/api/docs`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend rodando na porta ${port} [${isProduction ? 'PRODUÇÃO' : 'desenvolvimento'}]`);
}
bootstrap();
