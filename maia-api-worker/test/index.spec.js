import { describe, it, expect } from 'vitest';
import { hasYearMismatch } from '../src';

describe('hasYearMismatch unit tests', () => {
	it('returns true when there is a year mismatch between query and match metadata/slug/query', () => {
		const query = '2020_pv_impresso_d1_cd1';
		const match = {
			metadata: {
				slug: 'enem-2022-primeiro-dia-caderno-azul',
				year: 2022,
			},
		};
		expect(hasYearMismatch(query, match)).toBe(true);
	});

	it('returns false when the years match', () => {
		const query = '2020_pv_impresso_d1_cd1';
		const match = {
			metadata: {
				slug: 'enem-2020-primeiro-dia-caderno-azul',
				year: '2020',
			},
		};
		expect(hasYearMismatch(query, match)).toBe(false);
	});

	it('returns false when the query does not specify a year', () => {
		const query = 'enem primeiro dia caderno azul';
		const match = {
			metadata: {
				slug: 'enem-2022-primeiro-dia-caderno-azul',
				year: 2022,
			},
		};
		expect(hasYearMismatch(query, match)).toBe(false);
	});

	it('returns false when the match metadata has no year information', () => {
		const query = 'enem 2020';
		const match = {
			metadata: {
				slug: 'enem-primeiro-dia',
			},
		};
		expect(hasYearMismatch(query, match)).toBe(false);
	});

	it('correctly handles multiple years in query and allows matches with any of them', () => {
		const query = 'enem 2020 ou 2021';
		const match = {
			metadata: {
				slug: 'enem-2020',
				year: 2020,
			},
		};
		expect(hasYearMismatch(query, match)).toBe(false);
	});
});
