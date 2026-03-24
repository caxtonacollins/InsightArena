import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GenerateChallengeDto } from './dto/generate-challenge.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateChallenge: jest
              .fn()
              .mockImplementation((address: string) => {
                return `InsightArena:nonce:1234567890:randomStringFor${address}`;
              }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateChallenge', () => {
    it('should return a challenge string for a valid stellar_address', () => {
      const dto: GenerateChallengeDto = { stellar_address: 'GDQ...' };
      const result = controller.generateChallenge(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.generateChallenge).toHaveBeenCalledWith('GDQ...');
      expect(result).toHaveProperty('challenge');
      expect(result.challenge).toMatch(/^InsightArena:nonce:/);
    });
  });
});
