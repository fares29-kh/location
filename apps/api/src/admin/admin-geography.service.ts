import type {
  AdminDelegation,
  AdminGovernorate,
  AdminMunicipality,
  AuditAction,
  DelegationInput,
  DelegationUpdate,
  GovernorateInput,
  GovernorateUpdate,
  MunicipalityInput,
  MunicipalityUpdate,
} from '@drivetn/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { LocationsService } from '../locations/locations.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  alreadyUsed,
  auditLabel,
  inUse,
  isUniqueViolation,
  localizedName,
  nameColumns,
} from './referentials.utils';

interface Actor {
  actorId: string;
  ip: string | null;
}

const GOVERNORATE_COUNTS = {
  _count: { select: { delegations: true, agencies: true, locations: true } },
} satisfies Prisma.GovernorateInclude;

type GovernorateRow = Prisma.GovernorateGetPayload<{ include: typeof GOVERNORATE_COUNTS }>;

const DELEGATION_COUNTS = {
  _count: { select: { municipalities: true } },
} satisfies Prisma.DelegationInclude;

type DelegationRow = Prisma.DelegationGetPayload<{ include: typeof DELEGATION_COUNTS }>;

function toGovernorate(row: GovernorateRow): AdminGovernorate {
  return {
    code: row.code,
    slug: row.slug,
    name: localizedName(row),
    delegationsCount: row._count.delegations,
    agenciesCount: row._count.agencies,
    locationsCount: row._count.locations,
  };
}

function toDelegation(row: DelegationRow): AdminDelegation {
  return {
    id: row.id,
    governorateCode: row.governorateCode,
    name: localizedName(row),
    municipalitiesCount: row._count.municipalities,
  };
}

function toMunicipality(row: Prisma.MunicipalityGetPayload<object>): AdminMunicipality {
  return { id: row.id, delegationId: row.delegationId, name: localizedName(row) };
}

/** Référentiel géographique : gouvernorats, délégations et municipalités. */
@Injectable()
export class AdminGeographyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly locations: LocationsService,
  ) {}

  // --- Gouvernorats --------------------------------------------------------------------

  async listGovernorates(): Promise<AdminGovernorate[]> {
    const rows = await this.prisma.governorate.findMany({
      include: GOVERNORATE_COUNTS,
      orderBy: { code: 'asc' },
    });
    return rows.map(toGovernorate);
  }

  async createGovernorate(input: GovernorateInput, actor: Actor): Promise<AdminGovernorate> {
    if ((await this.prisma.governorate.findUnique({ where: { code: input.code } })) !== null) {
      throw alreadyUsed('code');
    }
    try {
      const row = await this.prisma.governorate.create({
        data: { code: input.code, slug: input.slug, ...nameColumns(input.name) },
        include: GOVERNORATE_COUNTS,
      });
      await this.locations.invalidate();
      await this.log('referential.created', auditLabel('Gouvernorat', row.nameFr), actor);
      return toGovernorate(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('slug');
      }
      throw error;
    }
  }

  async updateGovernorate(
    code: string,
    input: GovernorateUpdate,
    actor: Actor,
  ): Promise<AdminGovernorate> {
    const before = await this.prisma.governorate.findUnique({ where: { code } });
    if (before === null) {
      throw new NotFoundException('Gouvernorat introuvable.');
    }
    try {
      const row = await this.prisma.governorate.update({
        where: { code },
        data: { slug: input.slug, ...nameColumns(input.name) },
        include: GOVERNORATE_COUNTS,
      });
      await this.locations.invalidate();
      await this.log(
        'referential.updated',
        auditLabel('Gouvernorat', row.nameFr, before.nameFr),
        actor,
      );
      return toGovernorate(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('slug');
      }
      throw error;
    }
  }

  async deleteGovernorate(code: string, actor: Actor): Promise<void> {
    const row = await this.prisma.governorate.findUnique({
      where: { code },
      include: GOVERNORATE_COUNTS,
    });
    if (row === null) {
      throw new NotFoundException('Gouvernorat introuvable.');
    }
    const { agencies, locations, delegations } = row._count;
    if (agencies + locations + delegations > 0) {
      throw inUse('Des agences, lieux ou délégations sont rattachés à ce gouvernorat.');
    }
    await this.prisma.governorate.delete({ where: { code } });
    await this.locations.invalidate();
    await this.log('referential.deleted', auditLabel('Gouvernorat', row.nameFr), actor);
  }

  // --- Délégations ---------------------------------------------------------------------

  async listDelegations(governorateCode: string): Promise<AdminDelegation[]> {
    const rows = await this.prisma.delegation.findMany({
      where: { governorateCode },
      include: DELEGATION_COUNTS,
      orderBy: { nameFr: 'asc' },
    });
    return rows.map(toDelegation);
  }

  async createDelegation(input: DelegationInput, actor: Actor): Promise<AdminDelegation> {
    const governorate = await this.prisma.governorate.findUnique({
      where: { code: input.governorateCode },
    });
    if (governorate === null) {
      throw new NotFoundException('Gouvernorat introuvable.');
    }
    await this.assertDelegationNameFree(input.governorateCode, input.name.fr);
    try {
      const row = await this.prisma.delegation.create({
        data: { governorateCode: input.governorateCode, ...nameColumns(input.name) },
        include: DELEGATION_COUNTS,
      });
      await this.log(
        'referential.created',
        auditLabel('Délégation', `${row.nameFr} (${governorate.nameFr})`),
        actor,
      );
      return toDelegation(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name.fr');
      }
      throw error;
    }
  }

  async updateDelegation(
    id: string,
    input: DelegationUpdate,
    actor: Actor,
  ): Promise<AdminDelegation> {
    const before = await this.prisma.delegation.findUnique({ where: { id } });
    if (before === null) {
      throw new NotFoundException('Délégation introuvable.');
    }
    await this.assertDelegationNameFree(before.governorateCode, input.name.fr, id);
    try {
      const row = await this.prisma.delegation.update({
        where: { id },
        data: nameColumns(input.name),
        include: DELEGATION_COUNTS,
      });
      await this.log(
        'referential.updated',
        auditLabel('Délégation', row.nameFr, before.nameFr),
        actor,
      );
      return toDelegation(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name.fr');
      }
      throw error;
    }
  }

  async deleteDelegation(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.delegation.findUnique({
      where: { id },
      include: DELEGATION_COUNTS,
    });
    if (row === null) {
      throw new NotFoundException('Délégation introuvable.');
    }
    if (row._count.municipalities > 0) {
      throw inUse('Supprimez d’abord les municipalités de cette délégation.');
    }
    await this.prisma.delegation.delete({ where: { id } });
    await this.log('referential.deleted', auditLabel('Délégation', row.nameFr), actor);
  }

  // --- Municipalités -------------------------------------------------------------------

  async listMunicipalities(delegationId: string): Promise<AdminMunicipality[]> {
    const rows = await this.prisma.municipality.findMany({
      where: { delegationId },
      orderBy: { nameFr: 'asc' },
    });
    return rows.map(toMunicipality);
  }

  async createMunicipality(input: MunicipalityInput, actor: Actor): Promise<AdminMunicipality> {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id: input.delegationId },
    });
    if (delegation === null) {
      throw new NotFoundException('Délégation introuvable.');
    }
    await this.assertMunicipalityNameFree(input.delegationId, input.name.fr);
    try {
      const row = await this.prisma.municipality.create({
        data: { delegationId: input.delegationId, ...nameColumns(input.name) },
      });
      await this.log(
        'referential.created',
        auditLabel('Municipalité', `${row.nameFr} (${delegation.nameFr})`),
        actor,
      );
      return toMunicipality(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name.fr');
      }
      throw error;
    }
  }

  async updateMunicipality(
    id: string,
    input: MunicipalityUpdate,
    actor: Actor,
  ): Promise<AdminMunicipality> {
    const before = await this.prisma.municipality.findUnique({ where: { id } });
    if (before === null) {
      throw new NotFoundException('Municipalité introuvable.');
    }
    await this.assertMunicipalityNameFree(before.delegationId, input.name.fr, id);
    try {
      const row = await this.prisma.municipality.update({
        where: { id },
        data: nameColumns(input.name),
      });
      await this.log(
        'referential.updated',
        auditLabel('Municipalité', row.nameFr, before.nameFr),
        actor,
      );
      return toMunicipality(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name.fr');
      }
      throw error;
    }
  }

  async deleteMunicipality(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.municipality.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundException('Municipalité introuvable.');
    }
    await this.prisma.municipality.delete({ where: { id } });
    await this.log('referential.deleted', auditLabel('Municipalité', row.nameFr), actor);
  }

  // --- Unicité des noms (insensible à la casse) ------------------------------------------

  private async assertDelegationNameFree(
    governorateCode: string,
    nameFr: string,
    exceptId?: string,
  ): Promise<void> {
    const taken = await this.prisma.delegation.findFirst({
      where: {
        governorateCode,
        nameFr: { equals: nameFr, mode: 'insensitive' },
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (taken !== null) {
      throw alreadyUsed('name.fr');
    }
  }

  private async assertMunicipalityNameFree(
    delegationId: string,
    nameFr: string,
    exceptId?: string,
  ): Promise<void> {
    const taken = await this.prisma.municipality.findFirst({
      where: {
        delegationId,
        nameFr: { equals: nameFr, mode: 'insensitive' },
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (taken !== null) {
      throw alreadyUsed('name.fr');
    }
  }

  private log(action: AuditAction, label: string, actor: Actor): Promise<void> {
    return this.audit.log({
      action,
      actorId: actor.actorId,
      metadata: { changes: label },
      ip: actor.ip,
    });
  }
}
