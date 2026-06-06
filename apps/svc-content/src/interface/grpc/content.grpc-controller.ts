import { Controller, NotFoundException } from '@nestjs/common';
import { contentV1 } from '@lingua/contracts/proto';
import {
  GetScenarioUseCase,
  ListScenariosUseCase,
} from '../../application/scenario.usecases';

@Controller()
@contentV1.ContentServiceControllerMethods()
export class ContentGrpcController
  implements contentV1.ContentServiceController
{
  constructor(
    private readonly listScenariosUseCase: ListScenariosUseCase,
    private readonly getScenarioUseCase: GetScenarioUseCase,
  ) {}

  async listScenarios(
    _request: contentV1.ListScenariosRequest,
  ): Promise<contentV1.ListScenariosResponse> {
    const scenarios = await this.listScenariosUseCase.published();
    return { scenarios };
  }

  async getScenario(
    request: contentV1.GetScenarioRequest,
  ): Promise<contentV1.GetScenarioResponse> {
    try {
      const scenario = await this.getScenarioUseCase.byId(request.id);
      return { scenario };
    } catch (err) {
      if (err instanceof NotFoundException) return {};
      throw err;
    }
  }
}
