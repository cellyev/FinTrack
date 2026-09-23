import { IUuidGenerator, Uuid } from '@/core/domain/uuid-generator.interface';

export class MockUuidGenerator implements IUuidGenerator {
  private counter = 0;

  public generate(): Uuid {
    this.counter++;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }

  public isValid(id: string): boolean {
    return id.length === 36;
  }
}
