import { IsString, IsOptional, IsArray } from 'class-validator';

export class RequestOwnershipTransferDto {
  @IsString()
  contractId: string;
}

export class ReviewOwnershipTransferDto {
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentsRequired?: string[];
}

export class ApproveOwnershipTransferDto {
  @IsOptional()
  @IsString()
  approvalNotes?: string;
}

export class RejectOwnershipTransferDto {
  @IsString()
  reason: string;
}
