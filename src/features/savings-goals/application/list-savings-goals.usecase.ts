import { Result, ok, err, DomainError, ValidationError } from '@/core/domain/result';
import { ISavingsGoalRepository } from '../domain/savings-goal-repository.interface';
import { SavingsGoalProgress, calculateSavingsGoalProgress } from '../domain/savings-goal-progress';

export class ListSavingsGoalsUseCase {
  constructor(private readonly goalRepo: ISavingsGoalRepository) {}

  public async execute(params: { userId: string }): Promise<Result<SavingsGoalProgress[], DomainError>> {
    const { userId } = params;

    if (!userId || userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const goalsResult = await this.goalRepo.listActive(userId);
    if (!goalsResult.success) {
      return err(goalsResult.error);
    }

    const progressList = goalsResult.data.map((goal) => calculateSavingsGoalProgress(goal));
    return ok(progressList);
  }
}
