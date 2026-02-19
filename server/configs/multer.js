import multer from 'multer'
import os from 'os'

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
})

export const upload = multer({ storage })