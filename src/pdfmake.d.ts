// Version serveur de pdfmake importée explicitement (voir src/lib/server/pdf.ts) : mêmes types que "pdfmake".
declare module 'pdfmake/js/index.js' {
	import pdfmake from 'pdfmake';
	export default pdfmake;
}
