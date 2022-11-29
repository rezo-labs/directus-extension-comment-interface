<template>
	<div>
		<comment-input v-if="sortDirection === 'desc'" :collection="collection" :primary-key="primaryKey" :refresh="refresh" />

		<div v-else-if="!activity || activity.length === 0" class="empty">
			<div class="content">{{ t('no_comments') }}</div>
		</div>

		<template v-for="group in activity" :key="group.date.toString()">
			<v-divider>{{ group.dateFormatted }}</v-divider>

			<template v-for="item in group.activity" :key="item.id">
				<comment-item
					:refresh="refresh"
					:activity="item"
					:user-previews="userPreviews"
					:primary-key="primaryKey"
					:collection="collection"
				/>
			</template>
		</template>

		<comment-input v-if="sortDirection === 'asc'" :collection="collection" :primary-key="primaryKey" :refresh="refresh" />
	</div>
</template>

<script lang="ts">
import { useI18n } from 'vue-i18n';
import { useApi } from '@directus/shared/composables';
import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { groupBy, orderBy, flatten } from 'lodash';
import { isToday, isYesterday, format } from 'date-fns';
import CommentItem from './comment-item.vue';
import CommentInput from './comment-input.vue';
import { userName } from './utils';
import { Activity, ActivityByDate } from './types';

type ActivityByDateDisplay = ActivityByDate & {
	activity: (Activity & {
		display: string;
	})[];
};

export default defineComponent({
	inheritAttrs: false,
	components: {
		CommentItem,
		CommentInput,
	},
	props: {
		collection: {
			type: String,
			default: null,
		},
		primaryKey: {
			type: [String, Number],
			default: null,
		},
		refreshInterval: {
			type: Number,
			default: 10,
		},
		sortDirection: {
			type: String,
			default: 'asc',
		},
	},
	setup(props) {
		const { t } = useI18n();
		const api = useApi();

		const regex = /\s@[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}/gm;
		const activity = ref<ActivityByDateDisplay[] | null>(null);
		const count = ref(0);
		const error = ref(null);
		const loading = ref(false);
		const userPreviews = ref<Record<string, any>>({});

		getActivity();

		const activeInterval = ref<NodeJS.Timeout | null>(null);

		watch(
			() => props.refreshInterval,
			(newInterval) => {
				if (activeInterval.value !== null) {
					clearInterval(activeInterval.value);
				}
				if (newInterval !== null && newInterval > 0) {
					activeInterval.value = setInterval(() => {
						if (!loading.value) {
							getActivity();
						}
					}, newInterval * 1000);
				}
			},
			{ immediate: true }
		);

		onBeforeUnmount(() => {
			if (activeInterval.value !== null) {
				clearInterval(activeInterval.value);
			}
		});

		return { t, activity, count, error, loading, userPreviews, getActivity, refresh };

		async function getActivity() {
			error.value = null;
			loading.value = true;

			try {
				const response = await api.get(`/activity`, {
					params: {
						'filter[collection][_eq]': props.collection,
						'filter[item][_eq]': props.primaryKey,
						'filter[action][_eq]': 'comment',
						sort: props.sortDirection === 'asc' ? 'id' : '-id',
						fields: [
							'id',
							'action',
							'timestamp',
							'user.id',
							'user.email',
							'user.first_name',
							'user.last_name',
							'user.avatar.id',
							'revisions.id',
							'comment',
						],
					},
				});

				count.value = response.data.data.length;

				userPreviews.value = await loadUserPreviews(response.data.data, regex);

				const activityWithUsersInComments = (response.data.data as Activity[]).map((comment) => {
					const display = (comment.comment as string).replace(
						regex,
						(match) => `<mark>${userPreviews.value[match.substring(2)]}</mark>`
					).replace(/\n/g, '<br />');
					return {
						...comment,
						display,
					};
				});

				const activityByDate = groupBy(activityWithUsersInComments, (activity) => {
					// activity's timestamp date is in iso-8601
					const date = new Date(new Date(activity.timestamp).toDateString());
					return date;
				});

				const activityGrouped = [];

				for (const [key, value] of Object.entries(activityByDate)) {
					const date = new Date(key);
					const today = isToday(date);
					const yesterday = isYesterday(date);

					let dateFormatted: string;

					if (today) dateFormatted = t('today');
					else if (yesterday) dateFormatted = t('yesterday');
					else dateFormatted = format(date, 'dd/MM/yyyy');

					activityGrouped.push({
						date: date,
						dateFormatted: String(dateFormatted),
						activity: value,
					});
				}

				activity.value = orderBy(activityGrouped, ['date'], [props.sortDirection]);
			} catch (error: any) {
				error.value = error;
			} finally {
				loading.value = false;
			}
		}

		async function refresh() {
			await getActivity();
		}

		async function loadUserPreviews(comments: Record<string, any>, regex: RegExp) {
			let userPreviews: any[] = [];

			comments.forEach((comment: Record<string, any>) => {
				userPreviews.push(comment.comment.match(regex));
			});

			const uniqIds: string[] = [...new Set(flatten(userPreviews))].filter((id) => {
				if (id) return id;
			});

			if (uniqIds.length > 0) {
				const response = await api.get('/users', {
					params: {
						filter: { id: { _in: uniqIds.map((id) => id.substring(2)) } },
						fields: ['first_name', 'last_name', 'email', 'id'],
					},
				});

				const userPreviews: Record<string, string> = {};

				response.data.data.map((user: Record<string, any>) => {
					userPreviews[user.id] = userName(user, t);
				});

				return userPreviews;
			}

			return {};
		}
	},
});
</script>

<style lang="scss" scoped>
.v-divider {
	position: sticky;
	top: 0;
	z-index: 2;
	margin-top: 12px;
	margin-bottom: 2px;
	padding-top: 4px;
	padding-bottom: 4px;
	--v-divider-label-color: var(--foreground-subdued);
}

.empty {
	margin-top: 16px;
	margin-bottom: 8px;
	margin-left: 2px;
	color: var(--foreground-subdued);
	font-style: italic;
}
</style>
