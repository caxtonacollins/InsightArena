import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SorobanService } from '../soroban/soroban.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { Comment } from './entities/comment.entity';
import { MarketTemplate } from './entities/market-template.entity';
import { Market } from './entities/market.entity';
import { MarketsService } from './markets.service';

type MockRepo = jest.Mocked<
  Pick<Repository<Market>, 'create' | 'save' | 'findOne' | 'find'>
>;

describe('MarketsService', () => {
  let service: MarketsService;
  let marketsRepository: MockRepo;
  let sorobanService: jest.Mocked<
    Pick<SorobanService, 'createMarket' | 'resolveMarket'>
  >;

  const mockUser = {
    id: 'user-1',
    stellar_address: 'GABC123',
  } as User;

  const makeCreateDto = (): CreateMarketDto => ({
    title: 'Will ETH hit $10k?',
    description: 'Simple market description for testing',
    category: 'Crypto' as CreateMarketDto['category'],
    outcome_options: ['YES', 'NO'],
    end_time: new Date(Date.now() + 60_000).toISOString(),
    resolution_time: new Date(Date.now() + 120_000).toISOString(),
    creator_fee_bps: 100,
    min_stake_stroops: '1000',
    max_stake_stroops: '1000000',
    is_public: true,
  });

  beforeEach(async () => {
    marketsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    sorobanService = {
      createMarket: jest.fn(),
      resolveMarket: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketsService,
        {
          provide: getRepositoryToken(Market),
          useValue: marketsRepository,
        },
        {
          provide: getRepositoryToken(Comment),
          useValue: marketsRepository, // reuse marketsRepository mock structure
        },
        {
          provide: getRepositoryToken(MarketTemplate),
          useValue: marketsRepository,
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: SorobanService,
          useValue: sorobanService,
        },
      ],
    }).compile();

    service = module.get<MarketsService>(MarketsService);
  });

  it('createMarket() throws BadRequestException for past end_time', async () => {
    const dto = makeCreateDto();
    dto.end_time = new Date(Date.now() - 60_000).toISOString();

    await expect(service.createMarket(dto, mockUser)).rejects.toThrow(
      BadRequestException,
    );
    expect(sorobanService.createMarket).not.toHaveBeenCalled();
  });

  it('createMarket() saves market and returns it on Soroban success', async () => {
    const dto = makeCreateDto();

    sorobanService.createMarket.mockResolvedValue({
      market_id: 'market-on-chain-1',
      tx_hash: 'abc123',
    });

    const createdEntity = {
      on_chain_market_id: 'market-on-chain-1',
      title: dto.title,
    } as Market;

    const savedEntity = {
      ...createdEntity,
      id: 'market-db-1',
    } as Market;

    marketsRepository.create.mockReturnValue(createdEntity);
    marketsRepository.save.mockResolvedValue(savedEntity);

    const result = await service.createMarket(dto, mockUser);

    expect(sorobanService.createMarket).toHaveBeenCalled();
    expect(marketsRepository.create).toHaveBeenCalled();
    expect(marketsRepository.save).toHaveBeenCalledWith(createdEntity);
    expect(result).toEqual(savedEntity);
  });

  it('resolveMarket() throws ConflictException if already resolved', async () => {
    marketsRepository.findOne.mockResolvedValue({
      id: 'market-1',
      on_chain_market_id: 'on-chain-1',
      title: 'Resolved market',
      outcome_options: ['YES', 'NO'],
      is_resolved: true,
    } as Market);

    await expect(service.resolveMarket('market-1', 'YES')).rejects.toThrow(
      ConflictException,
    );
    expect(sorobanService.resolveMarket).not.toHaveBeenCalled();
  });

  it('resolveMarket() throws BadRequestException for invalid outcome', async () => {
    marketsRepository.findOne.mockResolvedValue({
      id: 'market-1',
      on_chain_market_id: 'on-chain-1',
      title: 'Unresolved market',
      outcome_options: ['YES', 'NO'],
      is_resolved: false,
    } as Market);

    await expect(service.resolveMarket('market-1', 'MAYBE')).rejects.toThrow(
      BadRequestException,
    );
    expect(sorobanService.resolveMarket).not.toHaveBeenCalled();
  });
});

describe('MarketsService.findFeaturedMarkets', () => {
  let service: MarketsService;
  let marketsRepository: jest.Mocked<Repository<Market>>;

  const makeFeaturedMarket = (overrides: Partial<Market> = {}): Market =>
    ({
      id: `market-${Math.random()}`,
      on_chain_market_id: `on-chain-${Math.random()}`,
      title: 'Featured Market',
      is_featured: true,
      featured_at: new Date(),
      is_public: true,
      is_cancelled: false,
      ...overrides,
    }) as Market;

  beforeEach(async () => {
    marketsRepository = {
      createQueryBuilder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketsService,
        {
          provide: getRepositoryToken(Market),
          useValue: marketsRepository,
        },
        {
          provide: getRepositoryToken(Comment),
          useValue: {},
        },
        {
          provide: getRepositoryToken(MarketTemplate),
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: SorobanService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MarketsService>(MarketsService);
  });

  it('returns featured markets with correct filters', async () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    marketsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder as any,
    );

    const featuredMarkets = [makeFeaturedMarket(), makeFeaturedMarket()];
    mockQueryBuilder.getManyAndCount.mockResolvedValue([featuredMarkets, 2]);

    const result = await service.findFeaturedMarkets(1, 20);

    expect(marketsRepository.createQueryBuilder).toHaveBeenCalledWith('market');
    expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
      'market',
      'creator',
    );
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      'market.is_featured = true',
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'market.is_public = true',
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'market.is_cancelled = false',
    );
    expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
      'market.featured_at',
      'DESC',
    );
    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    expect(result).toEqual({
      data: featuredMarkets,
      total: 2,
      page: 1,
      limit: 20,
    });
  });

  it('handles pagination correctly', async () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    marketsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder as any,
    );
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findFeaturedMarkets(2, 10);

    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
  });
});
