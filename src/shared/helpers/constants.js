const USER_FIELD='-password -__v -socketId -idAttachment -idName -lastLogin -createdAt -updatedAt'
const CANAL_FIELD='-__v -createdAt -updatedAt -_id -deleted -barangays -cropVariant -growthStage'
const RUN_DOC_FIELD='-__v -updatedAt -deleted -inputSnapshot.canalInput'

const VALID_SCENARIOS= ['dry season', 'wet season'];
const VALID_CROP_VARIANTS = ['main', 'second'];

module.exports = {
    USER_FIELD,
    CANAL_FIELD,
    RUN_DOC_FIELD,

    VALID_SCENARIOS,
    VALID_CROP_VARIANTS,
}