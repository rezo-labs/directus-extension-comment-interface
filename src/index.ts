import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'comment',
	name: 'Comment',
	icon: 'chat',
	description: 'Show comments in the form',
	component: InterfaceComponent,
	options: [],
	types: ['alias'],
	localTypes: ['presentation'],
	group: 'presentation',
});
