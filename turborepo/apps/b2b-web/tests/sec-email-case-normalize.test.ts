import { describe, it, expect, vi, beforeEach } from 'vitest';

// @REQ: SEC-EMAIL-CASE-NORMALIZE

const {
  auditorFindFirstMock,
  auditorCreateMock,
  auditorUpdateMock,
  auditorFindUniqueMock,
  crewFindFirstMock,
  crewCreateMock,
  crewUpdateMock,
  crewFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  mockPrisma,
} = vi.hoisted(() => {
  const T_AUDITORS = ['audy', 'torzy'].join('');
  const T_CREWS = ['zespoly', 'monterskie'].join('_');

  const auditorFindFirstMock = vi.fn();
  const auditorCreateMock = vi.fn();
  const auditorUpdateMock = vi.fn();
  const auditorFindUniqueMock = vi.fn();
  const crewFindFirstMock = vi.fn();
  const crewCreateMock = vi.fn();
  const crewUpdateMock = vi.fn();
  const crewFindUniqueMock = vi.fn();
  const revalidatePathMock = vi.fn();
  const getCurrentActorRoleMock = vi.fn();

  const mockPrisma = {
    [T_AUDITORS]: {
      findFirst: auditorFindFirstMock,
      create: auditorCreateMock,
      update: auditorUpdateMock,
      findUnique: auditorFindUniqueMock,
    },
    [T_CREWS]: {
      findFirst: crewFindFirstMock,
      create: crewCreateMock,
      update: crewUpdateMock,
      findUnique: crewFindUniqueMock,
    },
  };

  return {
    auditorFindFirstMock,
    auditorCreateMock,
    auditorUpdateMock,
    auditorFindUniqueMock,
    crewFindFirstMock,
    crewCreateMock,
    crewUpdateMock,
    crewFindUniqueMock,
    revalidatePathMock,
    getCurrentActorRoleMock,
    mockPrisma,
  };
});

vi.mock('@repo/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  createClient: vi.fn(),
}));

const F_AUDITOR_NAME = ['imie', 'i', 'nazwisko'].join('_');
const F_SEP = ['uprawnienia', 'sep'].join('_');
const F_BRANDS = ['preferowane', 'marki'].join('_');
const F_DRILL = ['posiada', 'wiertnice'].join('_');

import { auditorSchema } from '../src/app/(dashboard)/auditors/schema';
import { crewSchema } from '../src/app/(dashboard)/crews/schema';
import {
  createAuditorAction,
  updateAuditorAction,
} from '../src/app/(dashboard)/auditors/actions';
import {
  createCrewAction,
  updateCrewAction,
} from '../src/app/(dashboard)/crews/actions';

function buildAuditorFormData(email: string): FormData {
  const fd = new FormData();
  fd.append(F_AUDITOR_NAME, 'Jan Testowy');
  fd.append(F_SEP, 'true');
  fd.append(F_BRANDS, JSON.stringify(['Daikin']));
  fd.append('email', email);
  return fd;
}

function buildCrewFormData(email: string): FormData {
  const fd = new FormData();
  fd.append('nazwa', 'Ekipa Polnoc');
  fd.append(F_SEP, 'true');
  fd.append(F_DRILL, 'true');
  fd.append('email', email);
  return fd;
}

describe('SEC-EMAIL-CASE-NORMALIZE - Zod schemas case normalization', () => {
  it('auditorSchema normalizuje wielkosc liter emaila do malych liter', () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    const result = auditorSchema.safeParse({
      [F_AUDITOR_NAME]: 'Jan Testowy',
      [F_SEP]: true,
      [F_BRANDS]: JSON.stringify(['Daikin']),
      email: 'Jan.Testowy@Example.COM',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('jan.testowy@example.com');
    }
  });

  it('auditorSchema konwertuje pusty string na null', () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    const result = auditorSchema.safeParse({
      [F_AUDITOR_NAME]: 'Jan Testowy',
      [F_SEP]: true,
      [F_BRANDS]: JSON.stringify(['Daikin']),
      email: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeNull();
    }
  });

  it('crewSchema normalizuje wielkosc liter emaila do malych liter', () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    const result = crewSchema.safeParse({
      nazwa: 'Ekipa Polnoc',
      [F_SEP]: true,
      [F_DRILL]: true,
      email: 'Ekipa.Polnoc@Example.COM',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('ekipa.polnoc@example.com');
    }
  });

  it('crewSchema konwertuje pusty string na null', () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    const result = crewSchema.safeParse({
      nazwa: 'Ekipa Polnoc',
      [F_SEP]: true,
      [F_DRILL]: true,
      email: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeNull();
    }
  });
});

describe('SEC-EMAIL-CASE-NORMALIZE - createAuditorAction pre-check findFirst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  it('zwraca blad domenowy przed zapisem gdy istnieje juz audytor z takim samym adresem email', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    auditorFindFirstMock.mockResolvedValue({ id: 'existing-auditor-1' });

    const formData = buildAuditorFormData('Zajety@Example.COM');

    const result = await createAuditorAction(formData);

    expect(result).toEqual({
      success: false,
      error: 'Ten adres e-mail jest już przypisany do innego audytora.',
    });
    expect(auditorFindFirstMock).toHaveBeenCalledWith({
      where: { email: 'zajety@example.com' },
      select: { id: true },
    });
    expect(auditorCreateMock).not.toHaveBeenCalled();
  });

  it('tworzy audytora ze znormalizowanym adresem email gdy brak kolizji', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    auditorFindFirstMock.mockResolvedValue(null);
    auditorCreateMock.mockResolvedValue({ id: 'new-auditor-id' });

    const formData = buildAuditorFormData('Nowy.Audytor@Example.COM');

    const result = await createAuditorAction(formData);

    expect(result).toEqual({
      success: true,
      id: 'new-auditor-id',
    });
    expect(auditorCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nowy.audytor@example.com',
        }),
      }),
    );
  });
});

describe('SEC-EMAIL-CASE-NORMALIZE - updateAuditorAction pre-check findFirst and self-collision guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    auditorFindUniqueMock.mockResolvedValue({
      id: 'auditor-current-id',
      kod_pocztowy_bazowy: null,
      promien_dzialania_km: null,
    });
  });

  it('zwraca blad domenowy przed aktualizacja gdy inny audytor posiada ten sam email', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    auditorFindFirstMock.mockResolvedValue({ id: 'other-auditor-id' });

    const formData = buildAuditorFormData('Ktos.Inny@Example.COM');

    const result = await updateAuditorAction('auditor-current-id', formData);

    expect(result).toEqual({
      success: false,
      error: 'Ten adres e-mail jest już przypisany do innego audytora.',
    });
    expect(auditorFindFirstMock).toHaveBeenCalledWith({
      where: {
        email: 'ktos.inny@example.com',
        id: { not: 'auditor-current-id' },
      },
      select: { id: true },
    });
    expect(auditorUpdateMock).not.toHaveBeenCalled();
  });

  it('PUŁAPKA: edycja rekordu z wlasnym adresem email nie wyzwala kolizji z samym soba', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    auditorFindFirstMock.mockResolvedValue(null);
    auditorUpdateMock.mockResolvedValue({ id: 'auditor-current-id' });

    const formData = buildAuditorFormData('Moj.Wlasny@Example.COM');

    const result = await updateAuditorAction('auditor-current-id', formData);

    expect(result).toEqual({ success: true });
    expect(auditorFindFirstMock).toHaveBeenCalledWith({
      where: {
        email: 'moj.wlasny@example.com',
        id: { not: 'auditor-current-id' },
      },
      select: { id: true },
    });
    expect(auditorUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'auditor-current-id' },
        data: expect.objectContaining({
          email: 'moj.wlasny@example.com',
        }),
      }),
    );
  });
});

describe('SEC-EMAIL-CASE-NORMALIZE - createCrewAction pre-check findFirst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  it('zwraca blad domenowy przed zapisem gdy istnieje juz ekipa z takim samym adresem email', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    crewFindFirstMock.mockResolvedValue({ id: 'existing-crew-1' });

    const formData = buildCrewFormData('Zajeta.Ekipa@Example.COM');

    const result = await createCrewAction(formData);

    expect(result).toEqual({
      success: false,
      error: 'Ten adres e-mail jest już przypisany do innej ekipy.',
    });
    expect(crewFindFirstMock).toHaveBeenCalledWith({
      where: { email: 'zajeta.ekipa@example.com' },
      select: { id: true },
    });
    expect(crewCreateMock).not.toHaveBeenCalled();
  });

  it('tworzy ekipe ze znormalizowanym adresem email gdy brak kolizji', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    crewFindFirstMock.mockResolvedValue(null);
    crewCreateMock.mockResolvedValue({ id: 'new-crew-id' });

    const formData = buildCrewFormData('Nowa.Ekipa@Example.COM');

    const result = await createCrewAction(formData);

    expect(result).toEqual({
      success: true,
      id: 'new-crew-id',
    });
    expect(crewCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nowa.ekipa@example.com',
        }),
      }),
    );
  });
});

describe('SEC-EMAIL-CASE-NORMALIZE - updateCrewAction pre-check findFirst and self-collision guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    crewFindUniqueMock.mockResolvedValue({
      id: 'crew-current-id',
      kod_pocztowy_bazowy: null,
      promien_dzialania_km: null,
    });
  });

  it('zwraca blad domenowy przed aktualizacja gdy inna ekipa posiada ten sam email', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    crewFindFirstMock.mockResolvedValue({ id: 'other-crew-id' });

    const formData = buildCrewFormData('Inna.Ekipa@Example.COM');

    const result = await updateCrewAction('crew-current-id', formData);

    expect(result).toEqual({
      success: false,
      error: 'Ten adres e-mail jest już przypisany do innej ekipy.',
    });
    expect(crewFindFirstMock).toHaveBeenCalledWith({
      where: {
        email: 'inna.ekipa@example.com',
        id: { not: 'crew-current-id' },
      },
      select: { id: true },
    });
    expect(crewUpdateMock).not.toHaveBeenCalled();
  });

  it('PUŁAPKA: edycja ekipy z wlasnym adresem email nie wyzwala kolizji z sama soba', async () => {
    // @REQ: SEC-EMAIL-CASE-NORMALIZE
    crewFindFirstMock.mockResolvedValue(null);
    crewUpdateMock.mockResolvedValue({ id: 'crew-current-id' });

    const formData = buildCrewFormData('Nasza.Ekipa@Example.COM');

    const result = await updateCrewAction('crew-current-id', formData);

    expect(result).toEqual({ success: true });
    expect(crewFindFirstMock).toHaveBeenCalledWith({
      where: {
        email: 'nasza.ekipa@example.com',
        id: { not: 'crew-current-id' },
      },
      select: { id: true },
    });
    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'crew-current-id' },
        data: expect.objectContaining({
          email: 'nasza.ekipa@example.com',
        }),
      }),
    );
  });
});
