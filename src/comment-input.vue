<template>
	<div class="comment-input">
        <v-menu v-model="showMentionDropDown" attached>
			<template #activator>
				<v-template-input
					ref="commentElement"
					v-model="commentContent"
					capture-group="(@[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})"
					multiline
					trigger-character="@"
					:items="userPreviews"
					:placeholder="t('leave_comment')"
					@trigger="triggerSearch"
					@deactivate="showMentionDropDown = false"
					@up="pressedUp"
					@down="pressedDown"
					@enter="pressedEnter"
				/>
			</template>

			<v-list>
				<v-list-item
					v-for="(user, index) in searchResult"
					id="suggestions"
					:key="user.id"
					clickable
					:active="index === selectedKeyboardIndex"
					@click="insertUser(user)"
				>
					<v-list-item-icon>
						<v-avatar x-small>
							<img v-if="user.avatar" :src="avatarSource(user.avatar)" />
							<v-icon v-else name="person_outline" />
						</v-avatar>
					</v-list-item-icon>

					<v-list-item-content>{{ userName(user) }}</v-list-item-content>
				</v-list-item>
			</v-list>
		</v-menu>

		<div class="buttons">
			<v-button x-small secondary icon class="mention" @click="insertAt">
				<v-icon name="alternate_email" />
			</v-button>

			<div class="spacer"></div>

			<v-button class="cancel" x-small secondary @click="cancel">
				{{ t('cancel') }}
			</v-button>
			<v-button
				:disabled="!commentContent || commentContent.trim() === ''"
				:loading="saving"
				class="post-comment"
				x-small
				@click="postComment"
			>
				{{ t('submit') }}
			</v-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ComponentPublicInstance, onMounted, ref } from 'vue';
import { useApi } from '@directus/shared/composables';
import { throttle } from 'lodash';
import axios, { CancelTokenSource } from 'axios';
import { userName, addTokenToURL, getRootPath } from './utils';

const props = defineProps<{
	refresh: () => void;
	collection: string;
	primaryKey: string | number;
}>();

const { t } = useI18n();
const api = useApi();

const commentElement = ref<ComponentPublicInstance>();
let lastCaretPosition = 0;
let lastCaretOffset = 0;

onMounted(() => {
	commentElement.value?.$el.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.ctrlKey && event.key === 'Enter') {
			event.preventDefault();
			postComment();
		}
	});
});

const commentContent = ref('');
const saving = ref(false);
const showMentionDropDown = ref(false);

const searchResult = ref<any[]>([]);
const userPreviews = ref<Record<string, string>>({});

let triggerCaretPosition = 0;
const selectedKeyboardIndex = ref<number>(0);

let cancelToken: CancelTokenSource | null = null;

const loadUsers = throttle(async (name: string) => {
	if (cancelToken !== null) {
		cancelToken.cancel();
	}

	cancelToken = axios.CancelToken.source();

	const regex = /\s@[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}/gi;

	let filter: Record<string, any> = {
		_or: [
			{
				first_name: {
					_starts_with: name,
				},
			},
			{
				last_name: {
					_starts_with: name,
				},
			},
			{
				email: {
					_starts_with: name,
				},
			},
		],
	};

	if (name.match(regex)) {
		filter = {
			id: {
				_in: name,
			},
		};
	}

	try {
		const result = await api.get('/users', {
			params: {
				filter: name === '' || !name ? undefined : filter,
				fields: ['first_name', 'last_name', 'email', 'id', 'avatar'],
			},
			cancelToken: cancelToken.token,
		});

		const newUsers: Record<string, any> = {};

		result.data.data.forEach((user: any) => {
			newUsers[user.id] = userName(user, t);
		});

		userPreviews.value = newUsers;

		searchResult.value = result.data.data;
	} catch (e) {
		return e;
	}
}, 200);

// Why are selections so weird?
function saveCursorPosition() {
	if (document.getSelection) {
		const selection = document.getSelection();
		if (selection) {
			lastCaretOffset = selection.anchorOffset;

			const range = selection?.getRangeAt(0);
			range?.setStart(commentElement.value?.$el, 0);
			lastCaretPosition = range?.cloneContents().textContent?.length ?? 0;

			selection.removeAllRanges();
		}
	}
}

function insertAt() {
	saveCursorPosition();
	document.getSelection()?.removeAllRanges();
	insertText(' @');
}

function insertText(text: string) {
	if (commentContent.value === null) {
		lastCaretPosition = 0;
		commentContent.value = '';
	}

	commentContent.value = [
		commentContent.value.slice(0, lastCaretPosition),
		text,
		commentContent.value.slice(lastCaretPosition),
	].join('');

	setTimeout(() => {
		commentElement.value?.$el.focus();
		document.getSelection()?.setPosition(document.getSelection()?.anchorNode ?? null, lastCaretOffset + text.length);

		const inputEvent = new Event('input', { bubbles: true });
		commentElement.value?.$el.dispatchEvent(inputEvent);
	}, 10);
}

function insertUser(user: Record<string, any>) {
	const text = commentContent.value?.replaceAll(String.fromCharCode(160), ' ');
	if (!text) return;

	let countBefore = triggerCaretPosition - 1;
	let countAfter = triggerCaretPosition;

	if (text.charAt(countBefore) !== ' ' && text.charAt(countBefore) !== '\n') {
		while (countBefore >= 0 && text.charAt(countBefore) !== ' ' && text.charAt(countBefore) !== '\n') {
			countBefore--;
		}
	}

	while (countAfter < text.length && text.charAt(countAfter) !== ' ' && text.charAt(countAfter) !== '\n') {
		countAfter++;
	}

	const before = text.substring(0, countBefore + (text.charAt(countBefore) === '\n' ? 1 : 0));
	const after = text.substring(countAfter);

	commentContent.value = before + ' @' + user.id + after;
}

function triggerSearch({ searchQuery, caretPosition }: { searchQuery: string; caretPosition: number }) {
	triggerCaretPosition = caretPosition;

	showMentionDropDown.value = true;
	loadUsers(searchQuery);
	selectedKeyboardIndex.value = 0;
}

function avatarSource(url: string) {
	if (url === null) return '';
	return addTokenToURL(getRootPath() + `assets/${url}?key=system-small-cover`, api);
}

async function postComment() {
	if (!commentContent.value) {
		return;
	}
	saving.value = true;

	try {
		await api.post(`/activity/comment`, {
			collection: props.collection,
			item: props.primaryKey,
			comment: commentContent.value,
		});

		props.refresh();

		commentContent.value = '';
	} catch (err: any) {

	} finally {
		saving.value = false;
	}
}

function cancel() {
	commentContent.value = '';
}

function pressedUp() {
	if (selectedKeyboardIndex.value > 0) {
		selectedKeyboardIndex.value--;
	}
}

function pressedDown() {
	if (selectedKeyboardIndex.value < searchResult.value.length - 1) {
		selectedKeyboardIndex.value++;
	}
}

function pressedEnter() {
	insertUser(searchResult.value[selectedKeyboardIndex.value]);
	showMentionDropDown.value = false;
}
</script>

<style lang="scss" scoped>
.buttons {
	margin-top: 4px;
	display: flex;
	gap: 4px;

	.mention {
		--v-button-background-color: transparent;
		--v-button-color: var(--foreground-subdued);
		--v-button-color-hover: var(--primary);
	}

	.cancel {
		--v-button-color: var(--foreground-subdued);
	}

	.post-comment {
		--v-button-background-color-disabled: var(--background-normal-alt);
	}
}

.spacer {
	flex-grow: 1;
}
</style>
