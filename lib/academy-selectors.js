import { ACADEMY_VIDEOS } from '@/lib/academy-data';
import {
  ACADEMY_COURSES,
  ACADEMY_CURRICULUM_PATHWAYS,
} from '@/lib/academy-courses-data';
import { ACADEMY_PATHWAYS } from '@/lib/academy-pathways-data';
import { ACADEMY_PROGRAMS } from '@/lib/academy-programs-data';

function bySortOrder(first, second) {
  return (first.sortOrder ?? 999) - (second.sortOrder ?? 999);
}

export function getAcademyLessonBySlug(slug) {
  return ACADEMY_VIDEOS.find((lesson) => lesson.slug === slug);
}

export function getAcademyCourseBySlug(slug) {
  return ACADEMY_COURSES.find((course) => course.slug === slug);
}

export function getAcademyPathwayBySlug(slug) {
  return ACADEMY_PATHWAYS.find((pathway) => pathway.slug === slug);
}

export function getAcademyProgramBySlug(slug) {
  return ACADEMY_PROGRAMS.find((program) => program.slug === slug);
}

export function getPublishedAcademyLessons() {
  return ACADEMY_VIDEOS.filter(
    (lesson) => lesson.publishStatus === 'published'
  ).sort(bySortOrder);
}

export function getPublishedAcademyCourses() {
  return ACADEMY_COURSES.filter(
    (course) => course.publishStatus === 'published'
  ).sort(bySortOrder);
}

export function getPublishedAcademyPathways() {
  return ACADEMY_PATHWAYS.filter(
    (pathway) => pathway.publishStatus === 'published'
  ).sort(bySortOrder);
}

export function getPublishedAcademyPrograms() {
  return ACADEMY_PROGRAMS.filter(
    (program) => program.publishStatus === 'published'
  ).sort(bySortOrder);
}

export function getAcademyLessonsForPathway(pathwaySlug) {
  const pathway = getAcademyPathwayBySlug(pathwaySlug);

  if (!pathway) return [];

  const publishedLessons = getPublishedAcademyLessons();

  return pathway.recommendedLessonSlugs
    .map((lessonSlug) =>
      publishedLessons.find((lesson) => lesson.slug === lessonSlug)
    )
    .filter(Boolean);
}

export function getAcademyCoursesForPathway(pathwaySlug) {
  const pathway = getAcademyPathwayBySlug(pathwaySlug);

  if (!pathway) return [];

  const publishedCourses = getPublishedAcademyCourses();

  return pathway.relatedCourseSlugs
    .map((courseSlug) =>
      publishedCourses.find((course) => course.slug === courseSlug)
    )
    .filter(Boolean);
}

export function getCoursesForCurriculumPathway(curriculumPathwaySlug) {
  const curriculumPathway = ACADEMY_CURRICULUM_PATHWAYS.find(
    (pathway) => pathway.slug === curriculumPathwaySlug
  );

  if (!curriculumPathway) return [];

  return curriculumPathway.courseSlugs
    .map((courseSlug) =>
      ACADEMY_COURSES.find((course) => course.slug === courseSlug)
    )
    .filter(Boolean);
}