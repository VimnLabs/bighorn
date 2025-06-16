import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
	entries: ['src/index.ts'],
	declaration: true,
	rollup: {
		emitCJS: true,
		esbuild: { minifySyntax: true }
	},
	failOnWarn: false,
	outDir: './dist'
});
