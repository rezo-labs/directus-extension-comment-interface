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
				width: 'half',
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
		{
			field: 'sortDirection',
			name: 'Sort Direction',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: [
						{ text: 'Ascending', value: 'asc' },
						{ text: 'Descending', value: 'desc' },
					],
				},
			},
			schema: {
				default_value: 'asc',
			},
		},
	],
	types: ['alias'],
	localTypes: ['presentation'],
	group: 'presentation',
});
