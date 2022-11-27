import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'comment',
	name: 'Comment',
	icon: 'chat',
	description: 'Show comments in the form',
	component: InterfaceComponent,
	options: [
		{
			field: 'refreshInterval',
			name: 'Refresh Interval',
			type: 'integer',
			meta: {
				width: 'full',
				interface: 'input',
				options: {
					placeholder: '10',
					min: 1,
				},
			},
			schema: {
				default_value: 10,
			},
		},
	],
	types: ['alias'],
	localTypes: ['presentation'],
	group: 'presentation',
});
